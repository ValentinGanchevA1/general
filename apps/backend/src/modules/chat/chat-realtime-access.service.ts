import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type ConversationKind = 'dm' | 'group';

interface RealtimeRecipientRow {
  kind: ConversationKind;
  participant_ids: string[];
  blocked_pair: boolean;
}

/**
 * Authoritative recipient resolver for chat realtime delivery.
 *
 * DMs keep using the legacy two-person participant_ids key. Groups resolve only
 * active normalized conversation_members rows. Any bilateral block among the
 * resolved recipients fails the whole fanout closed rather than delivering a
 * partial group view.
 */
@Injectable()
export class ChatRealtimeAccessService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getRecipientIds(conversationId: string, dmOnly = false): Promise<string[]> {
    const [row] = await this.db.query<RealtimeRecipientRow[]>(
      `WITH target AS (
         SELECT c.id, c.kind, c.participant_ids
           FROM conversations c
          WHERE c.id = $1
          LIMIT 1
       ), resolved AS (
         SELECT t.kind,
                CASE
                  WHEN t.kind = 'group' THEN ARRAY(
                    SELECT cm.user_id
                      FROM conversation_members cm
                      JOIN users u
                        ON u.id = cm.user_id
                       AND u.deleted_at IS NULL
                     WHERE cm.conversation_id = t.id
                       AND cm.left_at IS NULL
                     ORDER BY cm.joined_at ASC, cm.user_id ASC
                  )
                  ELSE t.participant_ids
                END AS participant_ids
           FROM target t
       )
       SELECT r.kind,
              r.participant_ids,
              EXISTS (
                SELECT 1
                  FROM user_blocks b
                 WHERE b.blocker_id = ANY(r.participant_ids)
                   AND b.blocked_id = ANY(r.participant_ids)
                   AND b.blocker_id <> b.blocked_id
              ) AS blocked_pair
         FROM resolved r`,
      [conversationId],
    );

    if (row == null || row.blocked_pair) return [];
    if (dmOnly && row.kind !== 'dm') return [];
    return row.participant_ids;
  }
}
