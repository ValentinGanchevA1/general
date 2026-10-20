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
    const [social, gifts] = await Promise.all([
      this.interactions.listInbox(userId, take),
      this.listGifts(userId, take),
    ]);

    return [...social, ...gifts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take);
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
