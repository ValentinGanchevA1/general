import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { InboxItem } from '@g88/shared';

import { InteractionsService } from './interactions.service';

@Injectable()
export class InteractionsInboxService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly interactions: InteractionsService,
  ) {}

  async list(userId: string, limit = 50): Promise<InboxItem[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const [social, matches, gifts] = await Promise.all([
      this.interactions.listInbox(userId, take),
      this.listMatches(userId, take),
      this.listGifts(userId, take),
    ]);

    // A reciprocal wave that already produced a first-class match is the same
    // user event represented twice. Keep the match because it carries the
    // canonical conversationId used to open the chat.
    const matchedPeerIds = new Set(matches.map((item) => item.fromUser.id));
    const dedupedSocial = social.filter(
      (item) => !(item.type === 'wave' && item.isMutual === true && matchedPeerIds.has(item.fromUser.id)),
    );

    return [...dedupedSocial, ...matches, ...gifts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take);
  }

  /**
   * A match is a reciprocal-wave conversation, not merely any accepted chat.
   * The second wave is the canonical match timestamp because that is when
   * InteractionsService opens the conversation and emits wave:mutual.
   */
  private async listMatches(userId: string, limit: number): Promise<InboxItem[]> {
    const rows = await this.db.query<Array<{
      conversation_id: string;
      peer_id: string;
      display_name: string;
      avatar_url: string | null;
      verification_level: string | null;
      matched_at: Date;
    }>>(
      `WITH blocked AS (
         SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = $1
       ),
       matched AS (
         SELECT DISTINCT ON (w.conversation_id)
                w.conversation_id,
                w.created_at AS matched_at
           FROM waves w
          WHERE w.conversation_id IS NOT NULL
            AND (w.from_user_id = $1 OR w.to_user_id = $1)
          ORDER BY w.conversation_id, w.created_at DESC
       )
       SELECT m.conversation_id,
              u.id AS peer_id,
              u.display_name,
              u.avatar_url,
              u.verification_level,
              m.matched_at
         FROM matched m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN LATERAL (
           SELECT participant_id AS peer_id
             FROM unnest(c.participant_ids) AS participant_id
            WHERE participant_id <> $1::uuid
            LIMIT 1
         ) peer ON true
         JOIN users u ON u.id = peer.peer_id AND u.deleted_at IS NULL
        WHERE c.status = 'accepted'
          AND u.id NOT IN (SELECT uid FROM blocked)
        ORDER BY m.matched_at DESC
        LIMIT $2`,
      [userId, limit],
    );

    return rows.map((row): InboxItem => ({
      id: `match:${row.conversation_id}`,
      type: 'match',
      createdAt: row.matched_at.toISOString(),
      fromUser: {
        id: row.peer_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        verification: row.verification_level as InboxItem['fromUser']['verification'],
      },
      isMutual: true,
      match: { conversationId: row.conversation_id },
    }));
  }

  private async listGifts(userId: string, limit: number): Promise<InboxItem[]> {
    const rows = await this.db.query<Array<{
      id: string;
      emoji: string;
      label: string;
      message: string | null;
      created_at: Date;
      sender_id: string;
      display_name: string;
      avatar_url: string | null;
      verification_level: string | null;
    }>>(
      `WITH blocked AS (
         SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = $1
       )
       SELECT g.id,
              c.emoji,
              c.label,
              g.message,
              g.created_at,
              u.id AS sender_id,
              u.display_name,
              u.avatar_url,
              u.verification_level
         FROM gifts g
         JOIN gift_catalog c ON c.id = g.gift_id
         JOIN users u ON u.id = g.sender_id AND u.deleted_at IS NULL
        WHERE g.recipient_id = $1
          AND g.sender_id NOT IN (SELECT uid FROM blocked)
        ORDER BY g.created_at DESC
        LIMIT $2`,
      [userId, limit],
    );

    return rows.map((row): InboxItem => ({
      id: `gift:${row.id}`,
      type: 'gift',
      createdAt: row.created_at.toISOString(),
      fromUser: {
        id: row.sender_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        verification: row.verification_level as InboxItem['fromUser']['verification'],
      },
      gift: {
        emoji: row.emoji,
        label: row.label,
        message: row.message,
      },
    }));
  }
}
