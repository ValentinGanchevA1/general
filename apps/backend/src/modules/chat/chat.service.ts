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

@Injectable()
export class ChatService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Persist a message and bump last_message_at on the conversation.
   * Verifies the sender is a participant, and enforces the message-request gate
   * for `pending` conversations:
   *   - initiator: may send only the single request message (blocked until reply)
   *   - recipient: their first reply promotes the conversation to `accepted`
   *
   * Runs in a transaction with `FOR UPDATE` on the conversation row so two
   * concurrent sends can't both slip past the one-message cap.
   */
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

      return this.normalizeMessage(msg!);
    });
  }

  /**
   * Persist a location_session system message (counts toward pending-request quota).
   */
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
        status: ConversationStatus;
        initiated_by: string | null;
        last_message_at: string | null;
        last_body: string | null;
        last_sender_id: string | null;
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
       GROUP BY c.id, c.status, c.initiated_by, c.last_message_at, m.body, m.sender_id
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId],
    );

    return rows.map((r) => ({
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
