import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  GroupConversationRole,
  GroupConversationSummary,
} from '@g88/shared';

const MIN_INVITED_MEMBERS = 2;
const MAX_INVITED_MEMBERS = 19;
const MAX_TITLE_LENGTH = 80;

type GroupRow = {
  id: string;
  title: string;
  role: GroupConversationRole;
  muted: boolean;
  member_count: number | string;
  last_message_at: Date | string | null;
  created_at: Date | string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toSummary(row: GroupRow): GroupConversationSummary {
  return {
    id: row.id,
    title: row.title,
    role: row.role,
    muted: row.muted,
    memberCount: Number(row.member_count),
    lastMessageAt: row.last_message_at == null ? null : iso(row.last_message_at),
    createdAt: iso(row.created_at),
  };
}

@Injectable()
export class GroupConversationsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async create(
    creatorId: string,
    rawTitle: string,
    memberUserIds: string[],
  ): Promise<GroupConversationSummary> {
    const title = rawTitle.trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException({
        code: 'chat.group_title_invalid',
        message: 'Group title must be between 1 and 80 characters',
      });
    }

    const uniqueMemberIds = [...new Set(memberUserIds)];
    if (
      uniqueMemberIds.length !== memberUserIds.length ||
      uniqueMemberIds.length < MIN_INVITED_MEMBERS ||
      uniqueMemberIds.length > MAX_INVITED_MEMBERS
    ) {
      throw new BadRequestException({
        code: 'chat.group_members_invalid',
        message: 'A group requires 2 to 19 unique invited members',
      });
    }
    if (uniqueMemberIds.includes(creatorId)) {
      throw new BadRequestException({
        code: 'chat.group_creator_in_members',
        message: 'The group creator is added automatically',
      });
    }

    const allUserIds = [creatorId, ...uniqueMemberIds];

    return this.db.transaction(async (tx) => {
      const activeUsers = await tx.query<Array<{ id: string }>>(
        `SELECT id
           FROM users
          WHERE id = ANY($1::uuid[])
            AND deleted_at IS NULL`,
        [allUserIds],
      );
      if (activeUsers.length !== allUserIds.length) {
        throw new BadRequestException({
          code: 'chat.group_member_invalid',
          message: 'One or more group members are unavailable',
        });
      }

      const [blocked] = await tx.query<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
             FROM user_blocks ub
            WHERE ub.blocker_id = ANY($1::uuid[])
              AND ub.blocked_id = ANY($1::uuid[])
              AND ub.blocker_id <> ub.blocked_id
         ) AS exists`,
        [allUserIds],
      );
      if (blocked?.exists === true) {
        throw new ForbiddenException({
          code: 'chat.group_blocked_pair',
          message: 'This group cannot be created with the selected members',
        });
      }

      const [created] = await tx.query<
        Array<{
          id: string;
          title: string;
          last_message_at: Date | string | null;
          created_at: Date | string;
        }>
      >(
        `INSERT INTO conversations
           (participant_ids, kind, title, created_by, status, initiated_by)
         VALUES (ARRAY[]::uuid[], 'group', $1, $2, 'accepted', NULL)
         RETURNING id, title, last_message_at, created_at`,
        [title, creatorId],
      );
      if (!created) {
        throw new BadRequestException({
          code: 'chat.group_create_failed',
          message: 'Unable to create group conversation',
        });
      }

      await tx.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [created.id, creatorId],
      );
      await tx.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1, member_id, 'member'
           FROM unnest($2::uuid[]) AS member_id`,
        [created.id, uniqueMemberIds],
      );

      return toSummary({
        ...created,
        role: 'owner',
        muted: false,
        member_count: allUserIds.length,
      });
    });
  }

  async listForUser(userId: string): Promise<GroupConversationSummary[]> {
    const rows = await this.db.query<GroupRow[]>(
      `SELECT
         c.id,
         c.title,
         viewer.role,
         viewer.muted,
         COUNT(member.user_id)::int AS member_count,
         c.last_message_at,
         c.created_at
       FROM conversation_members viewer
       JOIN conversations c
         ON c.id = viewer.conversation_id
        AND c.kind = 'group'
       JOIN conversation_members member
         ON member.conversation_id = c.id
        AND member.left_at IS NULL
       WHERE viewer.user_id = $1
         AND viewer.left_at IS NULL
         AND c.title IS NOT NULL
         AND BTRIM(c.title) <> ''
       GROUP BY c.id, c.title, viewer.role, viewer.muted, c.last_message_at, c.created_at
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
      [userId],
    );

    return rows.map(toSummary);
  }
}
