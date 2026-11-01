import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import type {
  CreateGroupConversationRequest,
  CreateGroupConversationResponse,
  GroupConversationMember,
  GroupConversationSummary,
} from '@g88/shared';

type QueryExecutor = Pick<EntityManager, 'query'>;

interface GroupRow {
  id: string;
  title: string;
  created_by: string | null;
  last_message_at: Date | string | null;
  last_body: string | null;
  last_sender_id: string | null;
  unread_count: number;
  members: GroupConversationMember[];
}

interface EligibleMemberRow {
  id: string;
  is_friend: boolean;
  blocked: boolean;
}

@Injectable()
export class GroupConversationsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async create(
    creatorId: string,
    request: CreateGroupConversationRequest,
  ): Promise<CreateGroupConversationResponse> {
    const title = request.title.trim();
    if (title.length === 0 || title.length > 80) {
      throw new BadRequestException({
        code: 'chat.group_title_invalid',
        message: 'Group title must be between 1 and 80 characters',
      });
    }

    const memberIds = [...new Set(request.memberIds)];
    if (
      memberIds.length !== request.memberIds.length ||
      memberIds.length < 2 ||
      memberIds.length > 31 ||
      memberIds.includes(creatorId)
    ) {
      throw new BadRequestException({
        code: 'chat.group_members_invalid',
        message: 'Choose between 2 and 31 distinct members other than yourself',
      });
    }

    const expectedMemberIds = [creatorId, ...memberIds].sort((a, b) => a.localeCompare(b));

    return this.db.transaction(async (tx) => {
      const existingId = await this.findByCreationKey(tx, creatorId, request.clientRequestId);
      if (existingId != null) {
        await this.assertSameRetryPayload(tx, existingId, title, expectedMemberIds);
        return {
          conversation: await this.requireSummary(tx, existingId, creatorId),
          reused: true,
        };
      }

      await this.assertInviteesEligible(tx, creatorId, memberIds);

      const [created] = await tx.query<Array<{ id: string }>>(
        `INSERT INTO conversations
           (participant_ids, status, initiated_by, kind, title, created_by, creation_key)
         VALUES (ARRAY[]::uuid[], 'accepted', NULL, 'group', $1, $2, $3)
         ON CONFLICT (created_by, creation_key)
           WHERE kind = 'group' AND creation_key IS NOT NULL
         DO NOTHING
         RETURNING id`,
        [title, creatorId, request.clientRequestId],
      );

      if (created == null) {
        const concurrentId = await this.findByCreationKey(tx, creatorId, request.clientRequestId);
        if (concurrentId == null) {
          throw new ConflictException({
            code: 'chat.group_create_conflict',
            message: 'Group creation conflicted; retry with the same request id',
          });
        }
        await this.assertSameRetryPayload(tx, concurrentId, title, expectedMemberIds);
        return {
          conversation: await this.requireSummary(tx, concurrentId, creatorId),
          reused: true,
        };
      }

      await tx.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1,
                member_id,
                CASE WHEN member_id = $2::uuid THEN 'owner' ELSE 'member' END
           FROM unnest($3::uuid[]) AS member_id`,
        [created.id, creatorId, [creatorId, ...memberIds]],
      );

      return {
        conversation: await this.requireSummary(tx, created.id, creatorId),
        reused: false,
      };
    });
  }

  async list(userId: string): Promise<GroupConversationSummary[]> {
    const rows = await this.db.query<GroupRow[]>(
      `${this.summarySelectSql()}
       WHERE c.kind = 'group'
         AND c.title IS NOT NULL
         AND viewer.user_id = $1
         AND viewer.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1
             FROM conversation_members blocked_member
             JOIN user_blocks ub
               ON (ub.blocker_id = $1 AND ub.blocked_id = blocked_member.user_id)
               OR (ub.blocker_id = blocked_member.user_id AND ub.blocked_id = $1)
            WHERE blocked_member.conversation_id = c.id
              AND blocked_member.left_at IS NULL
              AND blocked_member.user_id <> $1
         )
       GROUP BY c.id, c.title, c.created_by, c.last_message_at,
                last_message.body, last_message.sender_id, c.created_at
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT 100`,
      [userId],
    );
    return rows.map((row) => this.mapSummary(row));
  }

  private async assertInviteesEligible(
    tx: QueryExecutor,
    creatorId: string,
    memberIds: string[],
  ): Promise<void> {
    const rows = await tx.query<EligibleMemberRow[]>(
      `SELECT u.id,
              EXISTS (
                SELECT 1
                  FROM friendships f
                 WHERE (f.user_low_id = $1 AND f.user_high_id = u.id)
                    OR (f.user_high_id = $1 AND f.user_low_id = u.id)
              ) AS is_friend,
              EXISTS (
                SELECT 1
                  FROM user_blocks b
                 WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                    OR (b.blocker_id = u.id AND b.blocked_id = $1)
              ) AS blocked
         FROM users u
        WHERE u.id = ANY($2::uuid[])
          AND u.deleted_at IS NULL`,
      [creatorId, memberIds],
    );

    if (
      rows.length !== memberIds.length ||
      rows.some((row) => row.is_friend !== true || row.blocked === true)
    ) {
      throw new ForbiddenException({
        code: 'chat.group_invite_forbidden',
        message: 'One or more selected members cannot be added to this group',
      });
    }
  }

  private async findByCreationKey(
    tx: QueryExecutor,
    creatorId: string,
    clientRequestId: string,
  ): Promise<string | null> {
    const [row] = await tx.query<Array<{ id: string }>>(
      `SELECT id
         FROM conversations
        WHERE kind = 'group'
          AND created_by = $1
          AND creation_key = $2
        LIMIT 1
        FOR UPDATE`,
      [creatorId, clientRequestId],
    );
    return row?.id ?? null;
  }

  private async assertSameRetryPayload(
    tx: QueryExecutor,
    conversationId: string,
    title: string,
    expectedMemberIds: string[],
  ): Promise<void> {
    const [row] = await tx.query<Array<{ title: string | null; member_ids: string[] }>>(
      `SELECT c.title,
              ARRAY(
                SELECT cm.user_id
                  FROM conversation_members cm
                 WHERE cm.conversation_id = c.id
                   AND cm.left_at IS NULL
                 ORDER BY cm.user_id
              ) AS member_ids
         FROM conversations c
        WHERE c.id = $1
          AND c.kind = 'group'
        LIMIT 1`,
      [conversationId],
    );

    const actualMemberIds = [...(row?.member_ids ?? [])].sort((a, b) => a.localeCompare(b));
    const sameMembers = actualMemberIds.length === expectedMemberIds.length &&
      actualMemberIds.every((id, index) => id === expectedMemberIds[index]);
    if (row?.title !== title || !sameMembers) {
      throw new ConflictException({
        code: 'chat.group_idempotency_conflict',
        message: 'This request id was already used with different group details',
      });
    }
  }

  private async requireSummary(
    tx: QueryExecutor,
    conversationId: string,
    viewerId: string,
  ): Promise<GroupConversationSummary> {
    const [row] = await tx.query<GroupRow[]>(
      `${this.summarySelectSql()}
       WHERE c.id = $1
         AND c.kind = 'group'
         AND c.title IS NOT NULL
         AND viewer.user_id = $2
         AND viewer.left_at IS NULL
       GROUP BY c.id, c.title, c.created_by, c.last_message_at,
                last_message.body, last_message.sender_id, c.created_at
       LIMIT 1`,
      [conversationId, viewerId],
    );
    if (row == null) {
      throw new NotFoundException({ code: 'chat.not_found', message: 'Conversation not found' });
    }
    return this.mapSummary(row);
  }

  private summarySelectSql(): string {
    return `SELECT c.id,
                   c.title,
                   c.created_by,
                   c.last_message_at,
                   last_message.body AS last_body,
                   last_message.sender_id AS last_sender_id,
                   (
                     SELECT COUNT(*)::int
                       FROM messages unread
                      WHERE unread.conversation_id = c.id
                        AND unread.sender_id <> viewer.user_id
                        AND unread.created_at > COALESCE(
                          (SELECT cr.last_read_at
                             FROM conversation_reads cr
                            WHERE cr.conversation_id = c.id
                              AND cr.user_id = viewer.user_id),
                          TIMESTAMPTZ 'epoch'
                        )
                   ) AS unread_count,
                   COALESCE(
                     json_agg(
                       json_build_object(
                         'id', member_user.id,
                         'displayName', member_user.display_name,
                         'avatarUrl', member_user.avatar_url,
                         'role', member.role
                       ) ORDER BY member.joined_at ASC, member.user_id ASC
                     ) FILTER (WHERE member_user.id IS NOT NULL),
                     '[]'::json
                   ) AS members
              FROM conversations c
              JOIN conversation_members viewer
                ON viewer.conversation_id = c.id
              JOIN conversation_members member
                ON member.conversation_id = c.id
               AND member.left_at IS NULL
              JOIN users member_user
                ON member_user.id = member.user_id
               AND member_user.deleted_at IS NULL
              LEFT JOIN LATERAL (
                SELECT m.body, m.sender_id
                  FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC
                 LIMIT 1
              ) last_message ON true`;
  }

  private mapSummary(row: GroupRow): GroupConversationSummary {
    const rawDate = row.last_message_at;
    return {
      id: row.id,
      kind: 'group',
      title: row.title,
      createdBy: row.created_by,
      members: row.members,
      lastMessageAt: rawDate instanceof Date ? rawDate.toISOString() : rawDate,
      lastMessage:
        row.last_body != null && row.last_sender_id != null
          ? { senderId: row.last_sender_id, body: row.last_body }
          : null,
      unreadCount: Number(row.unread_count) || 0,
    };
  }
}
