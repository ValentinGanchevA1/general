import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { ActivityItem, ActivityType, FeedResponse } from '@g88/shared';

import { FeedService } from './feed.service';

const MAX_DISTANCE_M = 10_000;
const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class PulseDiscoveryFeedService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly feed: FeedService,
  ) {}

  async aggregate(
    userId: string,
    since: Date,
    types: ActivityType[],
    limit: number,
  ): Promise<FeedResponse> {
    const wants = (type: ActivityType): boolean => types.includes(type);
    const legacyTypes = types.filter((type) => type === 'alert' || type === 'listing');

    const [base, events] = await Promise.all([
      legacyTypes.length > 0
        ? this.feed.aggregate(userId, since, legacyTypes, limit)
        : Promise.resolve<FeedResponse>({ items: [], nextSince: new Date().toISOString() }),
      wants('event') ? this.selectEvents(userId, limit) : Promise.resolve<ActivityItem[]>([]),
    ]);

    const items = [...base.items, ...events]
      .sort((a, b) => this.score(b) - this.score(a))
      .slice(0, limit);

    return {
      items,
      nextSince: items[0]?.createdAt ?? new Date().toISOString(),
    };
  }

  private score(item: ActivityItem): number {
    const ageMs = Math.max(0, Date.now() - new Date(item.createdAt).getTime());
    const recency = Math.max(0, 1 - ageMs / RECENCY_WINDOW_MS);
    const distance = item.distanceM == null
      ? 0.5
      : Math.max(0, 1 - item.distanceM / MAX_DISTANCE_M);
    const urgency = item.type === 'alert' ? 1 : item.type === 'event' ? 0.7 : 0.35;
    return recency * 0.45 + distance * 0.35 + urgency * 0.2;
  }

  private async selectEvents(userId: string, limit: number): Promise<ActivityItem[]> {
    const [user] = await this.db.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!user?.location_h3_r7) return [];

    const [lat, lng] = h3.cellToLatLng(user.location_h3_r7);
    const rows = await this.db.query<Array<{
      id: string;
      title: string;
      description: string | null;
      host_id: string;
      host_name: string;
      starts_at: Date;
      created_at: Date;
      distance_m: number;
    }>>(
      `SELECT e.id,
              e.title,
              e.description,
              e.host_id,
              u.display_name AS host_name,
              e.starts_at,
              e.created_at,
              ST_Distance(
                e.location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_m
         FROM events e
         JOIN users u ON u.id = e.host_id AND u.deleted_at IS NULL
        WHERE e.deleted_at IS NULL
          AND e.visibility = 'public'
          AND e.starts_at > NOW()
          AND ST_DWithin(
                e.location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
        ORDER BY e.starts_at ASC
        LIMIT $4`,
      [lng, lat, MAX_DISTANCE_M, limit],
    );

    return rows.map((row): ActivityItem => ({
      id: `event:${row.id}`,
      type: 'event',
      category: null,
      title: row.title,
      preview: row.description?.trim() || `Starts ${new Date(row.starts_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
      actorId: row.host_id,
      actorName: row.host_name,
      distanceM: Math.round(Number(row.distance_m)),
      createdAt: new Date(row.created_at).toISOString(),
      unread: false,
      narrative: {
        kind: 'event_created',
        verb: 'created',
        objectLabel: row.title,
        placeLabel: null,
      },
      deepLink: { screen: 'EventDetail', params: { eventId: row.id } },
    }));
  }
}
