import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  ConversationStatus,
  CreateConversationResponse,
  MessagePermission,
  ProfileRelationship,
} from '@g88/shared';

interface ConversationRow {
  id: string;
  status: ConversationStatus;
  initiated_by: string | null;
}

export interface MessagePermissionResult extends ProfileRelationship {
  /** The existing 1:1 conversation between the two users, if any. */
  conversation: { id: string; status: ConversationStatus; initiatedBy: string | null } | null;
}

/**
 * Owns the "who may message whom" gate. Depends only on the DataSource, so both
 * UsersModule (for the profile relationship block) and the chat surface can
 * consume it without a circular module dependency.
 *
 * The unlock ladder (option A + shared-interest requests):
 *   - reciprocal wave (accepted conversation) → `chat`
 *   - shared interest/goal, no match           → `request` (one message until reply)
 *   - neither                                  → `none` (wave only)
 */
@Injectable()
export class MessagingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Sorted participant pair — the stable uniqueness key for a 1:1 conversation. */
  private pairKey(a: string, b: string): string[] {
    return [a, b].sort();
  }

  /**
   * Compute the viewer's messaging relationship toward `targetId`. Interests and
   * goals are self-declared, so a shared overlap only ever grants `request`
   * (a single gated message) — never an open chat. The match (an accepted
   * conversation) is the only thing that grants `chat`.
   */
  async permissionFor(viewerId: string, targetId: string): Promise<MessagePermissionResult> {
    const [sharedRow] = await this.db.query<Array<{ shared: string[] | null }>>(
      `SELECT array(
                SELECT unnest(COALESCE(a.interests, '{}'::text[]) || COALESCE(a.goals, '{}'::text[]))
                INTERSECT
                SELECT unnest(COALESCE(b.interests, '{}'::text[]) || COALESCE(b.goals, '{}'::text[]))
              ) AS shared
         FROM users a, users b
        WHERE a.id = $1 AND b.id = $2
          AND a.deleted_at IS NULL AND b.deleted_at IS NULL`,
      [viewerId, targetId],
    );
    const sharedInterests = sharedRow?.shared ?? [];

    const [convo] = await this.db.query<ConversationRow[]>(
      `SELECT id, status, initiated_by
         FROM conversations
        WHERE participant_ids = $1::uuid[]
        LIMIT 1`,
      [this.pairKey(viewerId, targetId)],
    );

    const conversation = convo
      ? { id: convo.id, status: convo.status, initiatedBy: convo.initiated_by }
      : null;

    let canMessage: MessagePermission;
    if (conversation) {
      if (conversation.status === 'accepted') {
        canMessage = 'chat';
      } else {
        // A pending request the viewer received → their reply accepts it (chat).
        // A pending request the viewer sent → they must wait (request, capped).
        canMessage = conversation.initiatedBy === viewerId ? 'request' : 'chat';
      }
    } else {
      canMessage = sharedInterests.length > 0 ? 'request' : 'none';
    }

    return {
      matched: conversation?.status === 'accepted',
      sharedInterests,
      canMessage,
      conversation,
    };
  }

  /**
   * Open (or fetch) a conversation toward `targetId`, enforcing the gate.
   *  - match            → returns the existing accepted conversation.
   *  - shared interest  → get-or-creates a `pending` conversation initiated by
   *                       the viewer (the single request message is sent over
   *                       the normal chat path; the recipient's reply accepts it).
   *  - neither          → 403 `chat.locked`.
   */
  async openForMessaging(viewerId: string, targetId: string): Promise<CreateConversationResponse> {
    if (viewerId === targetId) {
      throw new BadRequestException({ code: 'chat.self', message: 'Cannot message yourself' });
    }

    const perm = await this.permissionFor(viewerId, targetId);
    if (perm.canMessage === 'none') {
      throw new ForbiddenException({
        code: 'chat.locked',
        message: 'Wave first — you can message once you match or share an interest',
      });
    }

    if (perm.conversation) {
      return {
        conversationId: perm.conversation.id,
        status: perm.conversation.status,
        permission: perm.canMessage === 'request' ? 'request' : 'chat',
      };
    }

    // No conversation yet → this is a fresh shared-interest request. Race-safe
    // get-or-create against the partial unique index on the sorted pair.
    const [created] = await this.db.query<ConversationRow[]>(
      `INSERT INTO conversations (participant_ids, status, initiated_by)
            VALUES ($1::uuid[], 'pending', $2)
       ON CONFLICT (participant_ids) WHERE array_length(participant_ids, 1) = 2
       DO UPDATE SET participant_ids = EXCLUDED.participant_ids
         RETURNING id, status, initiated_by`,
      [this.pairKey(viewerId, targetId), viewerId],
    );

    return {
      conversationId: created!.id,
      status: created!.status,
      permission: created!.status === 'accepted' ? 'chat' : 'request',
    };
  }
}
