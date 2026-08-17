import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  FriendCard,
  FriendRequestCard,
  FriendRequestsPage,
  FriendsPage,
  RelationshipSummary,
  RelationshipState,
} from '@g88/shared';

import { BlocksService } from '../blocks/blocks.service';
import { PresenceService } from '../presence/presence.service';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class FriendsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(forwardRef(() => BlocksService))
    private readonly blocks: BlocksService,
    private readonly presence: PresenceService,
  ) {}

  // ─── Follow ───────────────────────────────────────────────────────────────

  async follow(actorId: string, targetId: string): Promise<{ following: true }> {
    if (actorId === targetId) {
      throw new BadRequestException({ code: 'friends.self', message: 'Cannot follow yourself' });
    }
    if (await this.blocks.isBlocked(actorId, targetId)) {
      throw new ForbiddenException({
        code: 'friends.blocked',
        message: 'You cannot follow this user.',
      });
    }
    await this.assertUserExists(targetId);
    await this.db.query(
      `INSERT INTO follows (follower_id, followee_id)
            VALUES ($1, $2)
       ON CONFLICT (follower_id, followee_id) DO NOTHING`,
      [actorId, targetId],
    );
    return { following: true };
  }

  async unfollow(actorId: string, targetId: string): Promise<{ following: false }> {
    await this.db.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
      actorId,
      targetId,
    ]);
    return { following: false };
  }

  // ─── Friend requests ──────────────────────────────────────────────────────

  async requestFriend(actorId: string, targetId: string): Promise<{ requestId: string }> {
    if (actorId === targetId) {
      throw new BadRequestException({
        code: 'friends.self',
        message: 'Cannot send a friend request to yourself',
      });
    }
    if (await this.blocks.isBlocked(actorId, targetId)) {
      throw new ForbiddenException({
        code: 'friends.blocked',
        message: 'You cannot send a friend request to this user.',
      });
    }
    await this.assertUserExists(targetId);

    const [low, high] = orderedPair(actorId, targetId);
    const existingFriendship = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM friendships WHERE user_low_id = $1 AND user_high_id = $2
       ) AS exists`,
      [low, high],
    );
    if (existingFriendship[0]?.exists) {
      throw new ConflictException({
        code: 'friends.already_friends',
        message: 'You are already friends.',
      });
    }

    const inbound = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM friend_requests
        WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
        LIMIT 1`,
      [targetId, actorId],
    );
    if (inbound[0]) {
      await this.acceptRequest(inbound[0].id, actorId);
      return { requestId: inbound[0].id };
    }

    try {
      const rows = await this.db.query<Array<{ id: string }>>(
        `INSERT INTO friend_requests (requester_id, addressee_id, status)
              VALUES ($1, $2, 'pending')
           RETURNING id`,
        [actorId, targetId],
      );
      return { requestId: rows[0]!.id };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('friend_requests_pending_unique')) {
        throw new ConflictException({
          code: 'friends.request_pending',
          message: 'A friend request is already pending.',
        });
      }
      throw e;
    }
  }

  async acceptRequest(requestId: string, actorId: string): Promise<{ friends: true }> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<
        Array<{ id: string; requester_id: string; addressee_id: string; status: string }>
      >(
        `SELECT id, requester_id, addressee_id, status
           FROM friend_requests WHERE id = $1 FOR UPDATE`,
        [requestId],
      );
      const req = rows[0];
      if (!req) {
        throw new NotFoundException({ code: 'friends.request_not_found', message: 'Request not found' });
      }
      if (req.addressee_id !== actorId) {
        throw new ForbiddenException({
          code: 'friends.not_addressee',
          message: 'Only the recipient can accept this request.',
        });
      }
      if (req.status !== 'pending') {
        throw new ConflictException({
          code: 'friends.request_not_pending',
          message: 'This request is no longer pending.',
        });
      }

      const [low, high] = orderedPair(req.requester_id, req.addressee_id);
      await tx.query(
        `INSERT INTO friendships (user_low_id, user_high_id)
              VALUES ($1, $2)
         ON CONFLICT (user_low_id, user_high_id) DO NOTHING`,
        [low, high],
      );
      await tx.query(`DELETE FROM friend_requests WHERE id = $1`, [requestId]);

      // Bootstrap mutual follows on accept; either side may later unfollow without unfriending.
      await tx.query(
        `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.requester_id, req.addressee_id],
      );
      await tx.query(
        `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.addressee_id, req.requester_id],
      );

      return { friends: true as const };
    });
  }

  async declineRequest(requestId: string, actorId: string): Promise<{ declined: true }> {
    const rows = await this.db.query<Array<{ addressee_id: string; status: string }>>(
      `SELECT addressee_id, status FROM friend_requests WHERE id = $1`,
      [requestId],
    );
    const req = rows[0];
    if (!req) {
      throw new NotFoundException({ code: 'friends.request_not_found', message: 'Request not found' });
    }
    if (req.addressee_id !== actorId) {
      throw new ForbiddenException({
        code: 'friends.not_addressee',
        message: 'Only the recipient can decline this request.',
      });
    }
    if (req.status !== 'pending') {
      throw new ConflictException({
        code: 'friends.request_not_pending',
        message: 'This request is no longer pending.',
      });
    }
    await this.db.query(
      `UPDATE friend_requests
          SET status = 'declined', responded_at = NOW()
        WHERE id = $1`,
      [requestId],
    );
    return { declined: true };
  }

  async cancelRequest(requestId: string, actorId: string): Promise<{ cancelled: true }> {
    const rows = await this.db.query<Array<{ requester_id: string; status: string }>>(
      `SELECT requester_id, status FROM friend_requests WHERE id = $1`,
      [requestId],
    );
    const req = rows[0];
    if (!req) {
      throw new NotFoundException({ code: 'friends.request_not_found', message: 'Request not found' });
    }
    if (req.requester_id !== actorId) {
      throw new ForbiddenException({
        code: 'friends.not_requester',
        message: 'Only the sender can cancel this request.',
      });
    }
    if (req.status !== 'pending') {
      throw new ConflictException({
        code: 'friends.request_not_pending',
        message: 'This request is no longer pending.',
      });
    }
    await this.db.query(`DELETE FROM friend_requests WHERE id = $1`, [requestId]);
    return { cancelled: true };
  }

  /**
   * Removes the friendship only. Mutual follows are intentionally kept
   * (product rule: unfriend does not tear down the public follow graph).
   */
  async unfriend(actorId: string, targetId: string): Promise<{ friends: false }> {
    const [low, high] = orderedPair(actorId, targetId);
    await this.db.query(
      `DELETE FROM friendships WHERE user_low_id = $1 AND user_high_id = $2`,
      [low, high],
    );
    return { friends: false };
  }

  async onBlock(userA: string, userB: string): Promise<void> {
    const [low, high] = orderedPair(userA, userB);
    await this.db.transaction(async (tx) => {
      await tx.query(
        `DELETE FROM follows
          WHERE (follower_id = $1 AND followee_id = $2)
             OR (follower_id = $2 AND followee_id = $1)`,
        [userA, userB],
      );
      await tx.query(
        `DELETE FROM friendships WHERE user_low_id = $1 AND user_high_id = $2`,
        [low, high],
      );
      await tx.query(
        `UPDATE friend_requests
            SET status = 'cancelled', responded_at = NOW()
          WHERE status = 'pending'
            AND ((requester_id = $1 AND addressee_id = $2)
              OR (requester_id = $2 AND addressee_id = $1))`,
        [userA, userB],
      );
    });
  }

  // ─── Lists ────────────────────────────────────────────────────────────────

  async listFriends(actorId: string, cursor?: string, limit = DEFAULT_LIMIT): Promise<FriendsPage> {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const rows = await this.db.query<
      Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        created_at: Date;
        friends_see_online: boolean;
      }>
    >(
      `SELECT u.id AS user_id,
              u.display_name,
              u.avatar_url,
              f.created_at,
              COALESCE(u.friends_see_online_status, true) AS friends_see_online
         FROM friendships f
         JOIN users u ON u.id = CASE
           WHEN f.user_low_id = $1 THEN f.user_high_id
           ELSE f.user_low_id
         END AND u.deleted_at IS NULL
        WHERE (f.user_low_id = $1 OR f.user_high_id = $1)
          AND ($2::timestamptz IS NULL OR f.created_at < $2::timestamptz)
        ORDER BY f.created_at DESC
        LIMIT $3`,
      [actorId, cursor ?? null, take],
    );

    const ids = rows.map((r) => r.user_id);
    const onlineSet = await this.presence.whichAreOnline(ids);

    const items: FriendCard[] = rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      // Privacy: only report online when the friend allows friends to see status.
      online: r.friends_see_online ? onlineSet.has(r.user_id) : null,
      createdAt: r.created_at.toISOString(),
    }));

    const nextCursor =
      items.length === take ? items[items.length - 1]!.createdAt : null;
    return { items, nextCursor };
  }

  async listFriendIds(userId: string): Promise<string[]> {
    const rows = await this.db.query<Array<{ uid: string }>>(
      `SELECT CASE
                WHEN user_low_id = $1 THEN user_high_id
                ELSE user_low_id
              END AS uid
         FROM friendships
        WHERE user_low_id = $1 OR user_high_id = $1`,
      [userId],
    );
    return rows.map((r) => r.uid);
  }

  /** Whether this user allows close friends to see online status. */
  async friendsSeeOnlineStatus(userId: string): Promise<boolean> {
    const rows = await this.db.query<Array<{ allowed: boolean }>>(
      `SELECT COALESCE(friends_see_online_status, true) AS allowed
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    return rows[0]?.allowed !== false;
  }

  async listFollowing(
    actorId: string,
    cursor?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<FriendsPage> {
    return this.listFollowEdge(actorId, 'following', cursor, limit);
  }

  async listFollowers(
    actorId: string,
    cursor?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<FriendsPage> {
    return this.listFollowEdge(actorId, 'followers', cursor, limit);
  }

  async listPendingIncoming(
    actorId: string,
    cursor?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<FriendRequestsPage> {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const rows = await this.db.query<
      Array<{
        id: string;
        from_id: string;
        display_name: string;
        avatar_url: string | null;
        created_at: Date;
      }>
    >(
      `SELECT fr.id,
              fr.requester_id AS from_id,
              u.display_name,
              u.avatar_url,
              fr.created_at
         FROM friend_requests fr
         JOIN users u ON u.id = fr.requester_id AND u.deleted_at IS NULL
        WHERE fr.addressee_id = $1
          AND fr.status = 'pending'
          AND ($2::timestamptz IS NULL OR fr.created_at < $2::timestamptz)
        ORDER BY fr.created_at DESC
        LIMIT $3`,
      [actorId, cursor ?? null, take],
    );

    const items: FriendRequestCard[] = rows.map((r) => ({
      id: r.id,
      fromUserId: r.from_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      createdAt: r.created_at.toISOString(),
    }));
    const nextCursor =
      items.length === take ? items[items.length - 1]!.createdAt : null;
    return { items, nextCursor };
  }

  async relationship(viewerId: string, targetId: string): Promise<RelationshipSummary> {
    if (viewerId === targetId) {
      return {
        state: 'none',
        mutualFriendsCount: 0,
        isFollowing: false,
        isFollowedBy: false,
      };
    }

    const followFlags = await this.loadFollowFlags(viewerId, targetId);

    const [low, high] = orderedPair(viewerId, targetId);
    const [friendRow] = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM friendships WHERE user_low_id = $1 AND user_high_id = $2
       ) AS exists`,
      [low, high],
    );
    if (friendRow?.exists) {
      const mutual = await this.mutualFriendsCount(viewerId, targetId);
      return {
        state: 'friends',
        mutualFriendsCount: mutual,
        ...followFlags,
      };
    }

    const pending = await this.db.query<
      Array<{ id: string; requester_id: string; addressee_id: string }>
    >(
      `SELECT id, requester_id, addressee_id FROM friend_requests
        WHERE status = 'pending'
          AND ((requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1))
        LIMIT 1`,
      [viewerId, targetId],
    );
    if (pending[0]) {
      const mutual = await this.mutualFriendsCount(viewerId, targetId);
      const outgoing = pending[0].requester_id === viewerId;
      return {
        state: (outgoing ? 'request_outgoing' : 'request_incoming') as RelationshipState,
        requestId: pending[0].id,
        mutualFriendsCount: mutual,
        ...followFlags,
      };
    }

    let state: RelationshipState = 'none';
    if (followFlags.isFollowing && followFlags.isFollowedBy) state = 'mutual_follow';
    else if (followFlags.isFollowing) state = 'following';
    else if (followFlags.isFollowedBy) state = 'followed_by';

    const mutual = await this.mutualFriendsCount(viewerId, targetId);
    return { state, mutualFriendsCount: mutual, ...followFlags };
  }

  private async loadFollowFlags(
    viewerId: string,
    targetId: string,
  ): Promise<{ isFollowing: boolean; isFollowedBy: boolean }> {
    const edges = await this.db.query<Array<{ dir: string }>>(
      `SELECT 'out' AS dir FROM follows WHERE follower_id = $1 AND followee_id = $2
       UNION ALL
       SELECT 'in'  AS dir FROM follows WHERE follower_id = $2 AND followee_id = $1`,
      [viewerId, targetId],
    );
    return {
      isFollowing: edges.some((e) => e.dir === 'out'),
      isFollowedBy: edges.some((e) => e.dir === 'in'),
    };
  }

  private async listFollowEdge(
    actorId: string,
    mode: 'following' | 'followers',
    cursor: string | undefined,
    limit: number,
  ): Promise<FriendsPage> {
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const otherCol = mode === 'following' ? 'followee_id' : 'follower_id';
    const selfCol = mode === 'following' ? 'follower_id' : 'followee_id';

    const rows = await this.db.query<
      Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        created_at: Date;
      }>
    >(
      `SELECT u.id AS user_id,
              u.display_name,
              u.avatar_url,
              f.created_at
         FROM follows f
         JOIN users u ON u.id = f.${otherCol} AND u.deleted_at IS NULL
        WHERE f.${selfCol} = $1
          AND ($2::timestamptz IS NULL OR f.created_at < $2::timestamptz)
        ORDER BY f.created_at DESC
        LIMIT $3`,
      [actorId, cursor ?? null, take],
    );

    const items: FriendCard[] = rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      online: null,
      createdAt: r.created_at.toISOString(),
    }));
    const nextCursor =
      items.length === take ? items[items.length - 1]!.createdAt : null;
    return { items, nextCursor };
  }

  private async mutualFriendsCount(a: string, b: string): Promise<number> {
    const [row] = await this.db.query<Array<{ n: string }>>(
      `WITH a_friends AS (
         SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS uid
           FROM friendships WHERE user_low_id = $1 OR user_high_id = $1
       ),
       b_friends AS (
         SELECT CASE WHEN user_low_id = $2 THEN user_high_id ELSE user_low_id END AS uid
           FROM friendships WHERE user_low_id = $2 OR user_high_id = $2
       )
       SELECT COUNT(*)::text AS n
         FROM a_friends af
         JOIN b_friends bf ON bf.uid = af.uid`,
      [a, b],
    );
    return Number(row?.n ?? 0);
  }

  private async assertUserExists(userId: string): Promise<void> {
    const rows = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) {
      throw new NotFoundException({ code: 'friends.user_not_found', message: 'User not found' });
    }
  }
}
