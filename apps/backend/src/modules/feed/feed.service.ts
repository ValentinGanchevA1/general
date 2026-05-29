// apps/backend/src/modules/feed/feed.service.ts
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

    const [chats, waves, alerts] = await Promise.all([
      wanted('chat')  ? this.selectChats(userId, since, limit)  : Promise.resolve<ActivityItem[]>([]),
      wanted('wave')  ? this.selectWaves(userId, since, limit)  : Promise.resolve<ActivityItem[]>([]),
      wanted('alert') ? this.selectAlerts(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      // v1.5 sources slot in here: listings, matches
    ]);

    const items = [...chats, ...waves, ...alerts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    this.log.log(
      `feed.aggregate userId=${userId} latencyMs=${Date.now() - t0} ` +
      `chats=${chats.length} waves=${waves.length} alerts=${alerts.length} total=${items.length}`,
    );

    // Newest item's timestamp — clients pass it back as `since` to fetch what's even newer.
    return {
      items,
      nextSince: items[0]?.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * One row per conversation I belong to: the latest message, the other participant.
   * `unread` is a heuristic — we don't track read_at yet (P2/C6 outbox + read receipts).
   */
  private async selectChats(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<Array<{
      id: string; conversation_id: string;
      actor_id: string; actor_name: string;
      preview: string; created_at: Date; unread: boolean;
    }>>(
      `SELECT ('chat:' || c.id)                                   AS id,
              c.id                                                  AS conversation_id,
              other.id                                              AS actor_id,
              other.display_name                                    AS actor_name,
              m.body                                                AS preview,
              m.created_at                                          AS created_at,
              (m.sender_id <> $1 AND m.created_at > NOW() - interval '24 hours') AS unread
         FROM conversations c
         JOIN LATERAL (
           SELECT id, sender_id, body, created_at
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
          AND m.created_at > $2
        ORDER BY m.created_at DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => ({
      id: r.id, type: 'chat', category: null,
      title: r.actor_name ?? 'Unknown', preview: r.preview,
      actorId: r.actor_id, actorName: r.actor_name, distanceM: null,
      createdAt: new Date(r.created_at).toISOString(),
      unread: r.unread,
      deepLink: { screen: 'Chat', params: { conversationId: r.conversation_id, otherUserName: r.actor_name ?? 'Chat' } },
    }));
  }

  /**
   * Waves received. `unread` proxy: not yet reciprocated (responded_at IS NULL).
   * If a reciprocal wave already opened a conversation, tap goes to that Chat.
   */
  private async selectWaves(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<Array<{
      id: string; conversation_id: string | null;
      actor_id: string; actor_name: string;
      created_at: Date; unread: boolean;
    }>>(
      `SELECT ('wave:' || w.id)        AS id,
              w.conversation_id        AS conversation_id,
              w.from_user_id           AS actor_id,
              u.display_name           AS actor_name,
              w.created_at             AS created_at,
              (w.responded_at IS NULL) AS unread
         FROM waves w
         JOIN users u ON u.id = w.from_user_id AND u.deleted_at IS NULL
        WHERE w.to_user_id = $1
          AND w.created_at > $2
        ORDER BY w.created_at DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => ({
      id: r.id, type: 'wave', category: null,
      title: `${r.actor_name ?? 'Someone'} waved`,
      preview: r.conversation_id ? 'Conversation opened' : 'Wave back from the map',
      actorId: r.actor_id, actorName: r.actor_name, distanceM: null,
      createdAt: new Date(r.created_at).toISOString(),
      unread: r.unread,
      deepLink: r.conversation_id
        ? { screen: 'Chat', params: { conversationId: r.conversation_id, otherUserName: r.actor_name ?? 'Chat' } }
        : { screen: 'Main', params: { screen: 'Map' } },
    }));
  }

  /**
   * Alerts posted by anyone in the H3 r7 cells surrounding the requester's
   * last known location. Ring-1 disk = 7 cells ≈ 15km radius.
   * Falls back to empty if the requester has no location on record.
   */
  private async selectAlerts(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const [userRow] = await this.ds.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!userRow?.location_h3_r7) return [];

    const cells = h3.gridDisk(userRow.location_h3_r7, 1);

    const rows = await this.ds.query<Array<{
      id: string; alert_id: string; category: string;
      body: string; tag: string | null;
      actor_id: string; actor_name: string;
      created_at: Date;
    }>>(
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

    return rows.map((r): ActivityItem => ({
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
    }));
  }
}
