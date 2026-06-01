import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  ChatMessage,
  ConversationSummary,
  MessagePage,
} from '@g88/shared';

@Injectable()
export class ChatService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Persist a message and bump last_message_at on the conversation.
   * Verifies the sender is a participant before inserting.
   */
  async persist(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<ChatMessage> {
    const convo = await this.db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1 LIMIT 1`,
      [conversationId],
    );
    if (!convo[0]) throw new NotFoundException({ code: 'chat.not_found', message: 'Conversation not found' });
    if (!convo[0].participant_ids.includes(senderId)) {
      throw new ForbiddenException({ code: 'chat.forbidden', message: 'Not a participant' });
    }

    const [msg] = await this.db.query<ChatMessage[]>(
      `INSERT INTO messages (conversation_id, sender_id, body)
            VALUES ($1, $2, $3)
         RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", body, created_at AS "createdAt"`,
      [conversationId, senderId, body],
    );

    await this.db.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    const created = msg!.createdAt as Date | string;
    return { ...msg!, createdAt: created instanceof Date ? created.toISOString() : created };
  }

  /** Return participant IDs for a conversation — used by the realtime gateway for push routing. */
  async getParticipantIds(conversationId: string): Promise<string[]> {
    const [row] = await this.db.query<Array<{ participant_ids: string[] }>>(
      `SELECT participant_ids FROM conversations WHERE id = $1 LIMIT 1`,
      [conversationId],
    );
    return row?.participant_ids ?? [];
  }

  /** Verify membership without persisting — used by conversation:join gateway handler. */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM conversations WHERE id = $1 AND $2 = ANY(participant_ids) LIMIT 1`,
      [conversationId, userId],
    );
    return rows.length > 0;
  }

  /** List conversations the user participates in, newest activity first. Includes participant display names. */
  async findConversations(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.db.query<
      Array<{
        id: string;
        participant_ids: string[];
        last_message_at: string | null;
        last_body: string | null;
        last_sender_id: string | null;
        participants: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
      }>
    >(
      `SELECT
         c.id,
         c.participant_ids,
         c.last_message_at,
         m.body         AS last_body,
         m.sender_id    AS last_sender_id,
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
       GROUP BY c.id, c.last_message_at, m.body, m.sender_id
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id,
      participantIds: r.participant_ids,
      participants: r.participants,
      lastMessageAt: r.last_message_at ?? null,
      lastMessage: r.last_body != null && r.last_sender_id != null
        ? { senderId: r.last_sender_id, body: r.last_body }
        : null,
    }));
  }

  /**
   * Paginated message history, newest-first.
   * Cursor = ISO timestamp of the oldest message on the previous page.
   */
  async findMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ): Promise<MessagePage> {
    if (!(await this.isParticipant(conversationId, userId))) {
      throw new ForbiddenException({ code: 'chat.forbidden', message: 'Not a participant' });
    }

    const cap = Math.min(limit, 100);
    const rows = await this.db.query<ChatMessage[]>(
      `SELECT id,
              conversation_id AS "conversationId",
              sender_id       AS "senderId",
              body,
              created_at      AS "createdAt"
         FROM messages
        WHERE conversation_id = $1
          ${cursor ? `AND created_at < $3` : ''}
        ORDER BY created_at DESC
        LIMIT $2`,
      cursor ? [conversationId, cap + 1, cursor] : [conversationId, cap + 1],
    );

    const hasMore = rows.length > cap;
    const page = rows.slice(0, cap).map((r) => {
      const created = r.createdAt as Date | string;
      return { ...r, createdAt: created instanceof Date ? created.toISOString() : created };
    });

    return {
      messages: page,
      nextCursor: hasMore ? page[page.length - 1]!.createdAt : null,
    };
  }
}
