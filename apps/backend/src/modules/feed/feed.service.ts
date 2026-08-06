import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { ActivityItem, ActivityType, AreaCategory, FeedResponse } from '@g88/shared';

@Injectable()
export class FeedService {
  private readonly log = new Logger(FeedService.name);
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async aggregate(
    userId: string,
    since: Date,
    types: ActivityType[],
    limit: number,
  ): Promise<FeedResponse> {
    const t0 = Date.now();
    const wanted = (t: ActivityType): boolean => types.length === 0 || types.includes(t);

    const [chats, waves, alerts, listings, matches] = await Promise.all([
      wanted('chat') ? this.selectChats(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wanted('wave') ? this.selectWaves(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wanted('alert') ? this.selectAlerts(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wanted('listing') ? this.selectListings(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wanted('match') ? this.selectMatches(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
    ]);

    const items = [...chats, ...waves, ...alerts, ...listings, ...matches]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    this.log.log(
      `feed.aggregate userId=${userId} latencyMs=${Date.now() - t0} ` +
        `chats=${chats.length} waves=${waves.length} alerts=${alerts.length} ` +
        `listings=${listings.length} matches=${matches.length} total=${items.length}`,
    );

    return {
      items,
      nextSince: items[0]?.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * Conversations I participate in — aligned with ChatService.findConversations.
   * LEFT JOIN so wave-opened / empty threads still appear; activity time is
   * COALESCE(last message, last_message_at, conversation created_at).
   */
  private async selectChats(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<
      Array<{
        id: string;
        conversation_id: string;
        actor_id: string;
        actor_name: string;
        preview: string | null;
        created_at: Date;
        unread: boolean;
        status: string;
      }>
    >(
      `SELECT ('chat:' || c.id)                                   AS id,
              c.id                                                  AS conversation_id,
              other.id                                              AS actor_id,
              other.display_name                                    AS actor_name,
              m.body                                                AS preview,
              COALESCE(m.created_at, c.last_message_at, c.created_at) AS created_at,
              (
                m.sender_id IS NOT NULL
                AND m.sender_id <> $1
                AND m.created_at > NOW() - interval '24 hours'
              ) AS unread,
              COALESCE(c.status, 'accepted')                        AS status
         FROM conversations c
         LEFT JOIN LATERAL (
           SELECT sender_id, body, created_at
             FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
         ) m ON true
         JOIN LATERAL (
           SELECT u.id, u.display_name
             FROM users u
            WHERE u.id = ANY(c.participant_ids)
              AND u.id <> $1
              AND u.deleted_at IS NULL
            LIMIT 1
         ) other ON true
        WHERE $1 = ANY(c.participant_ids)
          AND COALESCE(m.created_at, c.last_message_at, c.created_at) > $2
        ORDER BY COALESCE(m.created_at, c.last_message_at, c.created_at) DESC NULLS LAST
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => {
      const isPending = r.status === 'pending';
      const preview =
        r.preview
        ?? (isPending ? 'Message request' : 'Say hi — open the chat');
      return {
        id: r.id,
        type: 'chat',
        category: null,
        title: r.actor_name ?? 'Unknown',
        preview,
        actorId: r.actor_id,
        actorName: r.actor_name,
        distanceM: null,
        createdAt: new Date(r.created_at).toISOString(),
        unread: Boolean(r.unread) || isPending,
        deepLink: {
          screen: 'Chat',
          params: {
            conversationId: r.conversation_id,
            otherUserName: r.actor_name ?? 'Chat',
            ...(isPending ? { requestPending: true } : {}),
          },
        },
      };
    });
  }

  private async selectWaves(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<
      Array<{
        id: string;
        conversation_id: string | null;
        actor_id: string;
        actor_name: string;
        created_at: Date;
        unread: boolean;
        direction: 'in' | 'out';
      }>
    >(
      `SELECT ('wave:' || w.id)            AS id,
              w.conversation_id            AS conversation_id,
              CASE WHEN w.to_user_id = $1 THEN w.from_user_id ELSE w.to_user_id END AS actor_id,
              u.display_name               AS actor_name,
              w.created_at                 AS created_at,
              (w.to_user_id = $1 AND w.responded_at IS NULL) AS unread,
              CASE WHEN w.to_user_id = $1 THEN 'in' ELSE 'out' END AS direction
         FROM waves w
         JOIN users u ON u.id = CASE
                WHEN w.to_user_id = $1 THEN w.from_user_id
                ELSE w.to_user_id
              END
           AND u.deleted_at IS NULL
        WHERE (w.to_user_id = $1 OR w.from_user_id = $1)
          AND w.created_at > $2
        ORDER BY w.created_at DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => {
      const inbound = r.direction === 'in';
      return {
        id: r.id,
        type: 'wave',
        category: null,
        title: inbound
          ? `${r.actor_name ?? 'Someone'} waved`
          : `You waved at ${r.actor_name ?? 'someone'}`,
        preview: r.conversation_id
          ? 'Match — conversation opened'
          : inbound
            ? 'Wave back from the map'
            : 'Waiting for a wave back',
        actorId: r.actor_id,
        actorName: r.actor_name,
        distanceM: null,
        createdAt: new Date(r.created_at).toISOString(),
        unread: r.unread,
        deepLink: r.conversation_id
          ? {
              screen: 'Chat',
              params: {
                conversationId: r.conversation_id,
                otherUserName: r.actor_name ?? 'Chat',
              },
            }
          : { screen: 'Main', params: { screen: 'Map' } },
      };
    });
  }

  private async selectAlerts(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const [userRow] = await this.ds.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!userRow?.location_h3_r7) return [];

    const cells = h3.gridDisk(userRow.location_h3_r7, 1);

    const rows = await this.ds.query<
      Array<{
        id: string;
        alert_id: string;
        category: string;
        body: string;
        tag: string | null;
        actor_id: string;
        actor_name: string;
        created_at: Date;
      }>
    >(
      `SELECT ('alert:' || a.id) AS id,
              a.id               AS alert_id,
              a.category,
              a.body,
              a.tag,
              u.id               AS actor_id,
              u.display_name     AS actor_name,
              a.created_at
         FROM alerts a
         JOIN users u ON u.id = a.author_id AND u.deleted_at IS NULL
        WHERE a.location_h3_r7 = ANY($1::text[])
          AND a.created_at > $2
          AND a.deleted_at IS NULL
          AND a.visibility = 'public'
        ORDER BY a.created_at DESC
        LIMIT $3`,
      [cells, since.toISOString(), limit],
    );

    return rows.map(
      (r): ActivityItem => ({
        id: r.id,
        type: 'alert',
        category: r.category as AreaCategory,
        title: r.tag ?? r.category.charAt(0).toUpperCase() + r.category.slice(1),
        preview: r.body,
        actorId: r.actor_id,
        actorName: r.actor_name,
        distanceM: null,
        createdAt: new Date(r.created_at).toISOString(),
        unread: true,
        deepLink: { screen: 'Main', params: { screen: 'Pulse' } },
      }),
    );
  }

  private async selectListings(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const [userRow] = await this.ds.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    const cells =
      userRow?.location_h3_r7 != null ? h3.gridDisk(userRow.location_h3_r7, 1) : ([] as string[]);

    const rows = await this.ds.query<
      Array<{
        id: string;
        listing_id: string;
        title: string;
        price_cents: number;
        currency: string;
        category: string;
        actor_id: string;
        actor_name: string;
        created_at: Date;
        is_mine: boolean;
      }>
    >(
      `SELECT ('listing:' || l.id) AS id,
              l.id                 AS listing_id,
              l.title,
              l.price_cents,
              l.currency,
              l.category,
              u.id                 AS actor_id,
              u.display_name       AS actor_name,
              l.created_at,
              (l.seller_id = $1)   AS is_mine
         FROM listings l
         JOIN users u ON u.id = l.seller_id AND u.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND l.status = 'active'
          AND l.visibility = 'public'
          AND l.created_at > $2
          AND (
            l.seller_id = $1
            OR (
              cardinality($3::text[]) > 0
              AND l.location_h3_r7 = ANY($3::text[])
            )
          )
        ORDER BY l.created_at DESC
        LIMIT $4`,
      [userId, since.toISOString(), cells, limit],
    );

    return rows.map((r): ActivityItem => {
      const price = `${(r.price_cents / 100).toFixed(r.price_cents % 100 === 0 ? 0 : 2)} ${r.currency}`;
      return {
        id: r.id,
        type: 'listing',
        category: null,
        title: r.title,
        preview: r.is_mine ? `Your listing · ${price}` : `${r.actor_name ?? 'Seller'} · ${price}`,
        actorId: r.actor_id,
        actorName: r.actor_name,
        distanceM: null,
        createdAt: new Date(r.created_at).toISOString(),
        unread: !r.is_mine,
        deepLink: { screen: 'ListingDetail', params: { listingId: r.listing_id } },
      };
    });
  }

  private async selectMatches(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<
      Array<{
        id: string;
        conversation_id: string;
        actor_id: string;
        actor_name: string;
        created_at: Date;
        preview: string | null;
      }>
    >(
      `SELECT ('match:' || c.id) AS id,
              c.id                 AS conversation_id,
              other.id             AS actor_id,
              other.display_name   AS actor_name,
              COALESCE(c.updated_at, c.created_at) AS created_at,
              (
                SELECT m.body
                  FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC
                 LIMIT 1
              ) AS preview
         FROM conversations c
         JOIN LATERAL (
           SELECT u.id, u.display_name
             FROM users u
            WHERE u.id = ANY(c.participant_ids)
              AND u.id <> $1
              AND u.deleted_at IS NULL
            LIMIT 1
         ) other ON true
        WHERE $1 = ANY(c.participant_ids)
          AND COALESCE(c.status, 'accepted') = 'accepted'
          AND COALESCE(c.updated_at, c.created_at) > $2
          AND EXISTS (
            SELECT 1 FROM waves w
             WHERE w.conversation_id = c.id
                OR (
                  (w.from_user_id = $1 AND w.to_user_id = other.id)
                  OR (w.to_user_id = $1 AND w.from_user_id = other.id)
                )
          )
        ORDER BY COALESCE(c.updated_at, c.created_at) DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map(
      (r): ActivityItem => ({
        id: r.id,
        type: 'match',
        category: null,
        title: r.actor_name ?? 'Match',
        preview: r.preview ?? 'You matched — say hi',
        actorId: r.actor_id,
        actorName: r.actor_name,
        distanceM: null,
        createdAt: new Date(r.created_at).toISOString(),
        unread: false,
        deepLink: {
          screen: 'Chat',
          params: { conversationId: r.conversation_id, otherUserName: r.actor_name ?? 'Chat' },
        },
      }),
    );
  }
}
