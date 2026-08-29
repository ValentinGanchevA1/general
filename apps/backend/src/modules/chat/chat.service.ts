import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  ChatLocation,
  ChatMessage,
  ConversationStatus,
  ConversationSummary,
  MessagePage,
} from '@g88/shared';

import { PresenceService } from '../presence/presence.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
  ) {}

  async persist(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<ChatMessage> {
    return this.db.transaction(async (tx) => {
      await this.enforceParticipantAndRequestGate(tx, conversationId, senderId);

      const [msg] = await tx.query<ChatMessage[]>(
        `INSERT INTO messages (conversation_id, sender_id, body, type)
              VALUES ($1, $2, $3, 'text')
           RETURNING id,
                     conversation_id AS "conversationId",
                     sender_id AS "senderId",
                     body,
                     type,
                     location,
                     location_session_id AS "locationSessionId",
                     created_at AS "createdAt"`,
        [conversationId, senderId, body],
      );

      await tx.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId],
      );

      // Sender has effectively "read" up to their own send.
      await tx.query(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
        [conversationId, senderId],
      );

      return this.normalizeMessage(msg!);
    });
  }

  async persistLocationSession(
    conversationId: string,
    senderId: string,
    sessionId: string,
    body: string,
    location: ChatLocation,
  ): Promise<ChatMessage> {
    return this.db.transaction(async (tx) => {
      await this.enforceParticipantAndRequestGate(tx, conversationId, senderId);

      const [msg] = await tx.query<ChatMessage[]>(
        `INSERT INTO messages
           (conversation_id, sender_id, body, type, location, location_session_id)
         VALUES ($1, $2, $3, 'location_session', $4::jsonb, $5)
         RETURNING id,
                   conversation_id AS "conversationId",
                   sender_id AS "senderId",
                   body,
                   type,
                   location,
                   location_session_id AS "locationSessionId",
                   created_at AS "createdAt"`,
        [conversationId, senderId, body, JSON.stringify(location), sessionId],
      );

      await tx.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId],
      );

      await tx.query(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
        [conversationId, senderId],
      );

      return this.normalizeMessage(msg!);
    });
  }

  private async enforceParticipantAndRequestGate(
    tx: DataSource['manager'],
    conversationId: string,
    senderId: string,
  ): Promise<void> {
    const [convo] = await tx.query<
      Array<{ participant_ids: string[]; status: string; initiated_by: string | null }>
    >(
      `SELECT participant_ids, status, initiated_by
         FROM conversations WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [conversationId],
    );
    if (!convo) {
      throw new NotFoundException({ code: 'chat.not_found', message: 'Conversation not found' });
    }
    if (!convo.participant_ids.includes(senderId)) {
      throw new ForbiddenException({ code: 'chat.forbidden', message: 'Not a participant' });
    }

    if (convo.status === 'pending') {
      if (convo.initiated_by === senderId) {
        const [counted] = await tx.query<Array<{ count: number }>>(
          `SELECT COUNT(*)::int AS count FROM messages WHERE conversation_id = $1`,
          [conversationId],
        );
        if ((counted?.count ?? 0) > 0) {
          throw new ForbiddenException({
            code: 'chat.request_pending',
            message: 'Wait for them to reply before sending another message',
          });
        }
      } else {
        await tx.query(`UPDATE conversations SET status = 'accepted' WHERE id = $1`, [
          conversationId,
        ]);
      }
    }
  }

  private normalizeMessage(msg: ChatMessage): ChatMessage {
    const created = msg.createdAt as Date | string;
    return {
      ...msg,
      type: msg.type ?? 'text',
      location: msg.location ?? null,
      locationSessionId: msg.locationSessionId ?? null,
      createdAt: created instanceof Date ? created.toISOString() : created,
    };
  }

  async getParticipantIds(conversationId: string): Promise<string[]> {
    const [row] = await this.db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1 LIMIT 1`,
      [conversationId],
    );
    return row?.participant_ids ?? [];
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM conversations WHERE id = $1 AND $2 = ANY(participant_ids) LIMIT 1`,
      [conversationId, userId],
    );
    return rows.length > 0;
  }

  /** Upsert last_read_at so unreadCount drops for this viewer. */
  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [conversationId, userId],
    );
  }

  /**
   * Order: close friends first, then online friends, then last activity.
   * peerOnline respects friends_see_online_status.
   * unreadCount = peer messages after viewer's last_read_at.
   */
  async findConversations(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.db.query<
      Array<{
        id: string;
        participant_ids: string[];
        status: ConversationStatus;
        initiated_by: string | null;
        last_message_at: string | null;
        last_body: string | null;
        last_sender_id: string | null;
        is_friend: boolean;
        peer_id: string | null;
        peer_allows_online: boolean;
        unread_count: number;
        participants: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
      }>
    >(
      `SELECT
         c.id,
         c.participant_ids,
         c.status,
         c.initiated_by,
         c.last_message_at,
         m.body         AS last_body,
         m.sender_id    AS last_sender_id,
         EXISTS (
           SELECT 1
             FROM friendships f
            WHERE (f.user_low_id = $1 AND f.user_high_id = ANY (c.participant_ids) AND f.user_high_id <> $1)
               OR (f.user_high_id = $1 AND f.user_low_id = ANY (c.participant_ids) AND f.user_low_id <> $1)
         ) AS is_friend,
         (
           SELECT p
             FROM unnest(c.participant_ids) AS p
            WHERE p <> $1
            LIMIT 1
         ) AS peer_id,
         COALESCE(
           (
             SELECT u.friends_see_online_status
               FROM users u
              WHERE u.id = (
                SELECT p FROM unnest(c.participant_ids) AS p WHERE p <> $1 LIMIT 1
              )
                AND u.deleted_at IS NULL
           ),
           true
         ) AS peer_allows_online,
         (
           SELECT COUNT(*)::int
             FROM messages um
            WHERE um.conversation_id = c.id
              AND um.sender_id <> $1
              AND um.created_at > COALESCE(
                (SELECT cr.last_read_at
                   FROM conversation_reads cr
                  WHERE cr.conversation_id = c.id AND cr.user_id = $1),
                TIMESTAMPTZ 'epoch'
              )
         ) AS unread_count,
         COALESCE(
           json_agg(
             json_build_object('id', u.id, 'displayName', u.display_name, 'avatarUrl', u.avatar_url)
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'
         ) AS participants
       FROM conversations c
       LEFT JOIN LATERAL (
         SELECT body, sender_id
           FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
       ) m ON true
       LEFT JOIN users u ON u.id = ANY(c.participant_ids) AND u.deleted_at IS NULL
       WHERE $1 = ANY(c.participant_ids)
       GROUP BY c.id, c.status, c.initiated_by, c.last_message_at, m.body, m.sender_id, c.participant_ids
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId],
    );

    const peerIds = [
      ...new Set(
        rows
          .filter((r) => r.is_friend && r.peer_id && r.peer_allows_online)
          .map((r) => r.peer_id as string),
      ),
    ];
    const onlineSet = peerIds.length
      ? await this.presence.whichAreOnline(peerIds)
      : new Set<string>();

    const mapped: ConversationSummary[] = rows.map((r) => {
      const isFriend = r.is_friend === true;
      let peerOnline: boolean | null = null;
      if (isFriend && r.peer_id && r.peer_allows_online) {
        peerOnline = onlineSet.has(r.peer_id);
      }
      return {
        id: r.id,
        participantIds: r.participant_ids,
        participants: r.participants,
        lastMessageAt: r.last_message_at ?? null,
        lastMessage:
          r.last_body != null && r.last_sender_id != null
            ? { senderId: r.last_sender_id, body: r.last_body }
            : null,
        status: r.status,
        initiatedBy: r.initiated_by,
        isFriend,
        peerOnline,
        unreadCount: Number(r.unread_count) || 0,
      };
    });

    mapped.sort((a, b) => {
      const af = a.isFriend ? 1 : 0;
      const bf = b.isFriend ? 1 : 0;
      if (af !== bf) return bf - af;
      if (af === 1) {
        const ao = a.peerOnline === true ? 1 : 0;
        const bo = b.peerOnline === true ? 1 : 0;
        if (ao !== bo) return bo - ao;
      }
      const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bt - at;
    });

    return mapped;
  }

  async findMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ): Promise<MessagePage> {
    if (!(await this.isParticipant(conversationId, userId))) {
      throw new ForbiddenException({ code: 'chat.forbidden', message: 'Not a participant' });
    }

    // Opening the thread marks it read (first page only — not pagination).
    if (!cursor) {
      await this.markConversationRead(conversationId, userId);
    }

    const cap = Math.min(limit, 100);
    const rows = await this.db.query<ChatMessage[]>(
      `SELECT id,
              conversation_id AS "conversationId",
              sender_id       AS "senderId",
              body,
              type,
              location,
              location_session_id AS "locationSessionId",
              created_at      AS "createdAt"
         FROM messages
        WHERE conversation_id = $1
          ${cursor ? `AND created_at < $3` : ''}
        ORDER BY created_at DESC
        LIMIT $2`,
      cursor ? [conversationId, cap + 1, cursor] : [conversationId, cap + 1],
    );

    const hasMore = rows.length > cap;
    const page = rows.slice(0, cap).map((r) => this.normalizeMessage(r));

    return {
      messages: page,
      nextCursor: hasMore ? page[page.length - 1]!.createdAt : null,
    };
  }
}
