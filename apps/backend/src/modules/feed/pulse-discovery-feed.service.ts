import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { ActivityItem, ActivityType, FeedResponse } from '@g88/shared';

import { FeedService } from './feed.service';

const MAX_DISTANCE_M = 10_000;
const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_IN_CELL_RADIUS = 8;

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

    const [base, events, eventJoins, checkIns] = await Promise.all([
      legacyTypes.length > 0
        ? this.feed.aggregate(userId, since, legacyTypes, limit)
        : Promise.resolve<FeedResponse>({ items: [], nextSince: new Date().toISOString() }),
      wants('event') ? this.selectEvents(userId, limit) : Promise.resolve<ActivityItem[]>([]),
      wants('event') ? this.selectEventJoins(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wants('place') ? this.selectCheckIns(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
    ]);

    const items = [
      ...base.items.map((item) => this.withNarrative(item)),
      ...events,
      ...eventJoins,
      ...checkIns,
    ]
      .sort((a, b) => this.score(b) - this.score(a))
      .slice(0, limit);

    return {
      items,
      nextSince: items[0]?.createdAt ?? new Date().toISOString(),
    };
  }

  private withNarrative(item: ActivityItem): ActivityItem {
    if (item.narrative) return item;

    if (item.type === 'listing') {
      return {
        ...item,
        narrative: {
          kind: 'listing_created',
          verb: 'listed',
          objectLabel: item.title,
          placeLabel: null,
        },
      };
    }

    if (item.type === 'alert') {
      return {
        ...item,
        narrative: {
          kind: 'alert_posted',
          verb: 'posted',
          objectLabel: item.title,
          placeLabel: null,
        },
      };
    }

    return item;
  }

  private score(item: ActivityItem): number {
    const ageMs = Math.max(0, Date.now() - new Date(item.createdAt).getTime());
    const recency = Math.max(0, 1 - ageMs / RECENCY_WINDOW_MS);
    const distance = item.distanceM == null
      ? 0.5
      : Math.max(0, 1 - item.distanceM / MAX_DISTANCE_M);
    const urgency = item.type === 'alert'
      ? 1
      : item.type === 'place'
        ? 0.8
        : item.type === 'event'
          ? 0.7
          : 0.35;
    return recency * 0.45 + distance * 0.35 + urgency * 0.2;
  }

  private async selectCheckIns(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<ActivityItem[]> {
    const [viewer] = await this.db.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!viewer?.location_h3_r7) return [];

    const cells = h3.gridDisk(viewer.location_h3_r7, CHECK_IN_CELL_RADIUS);
    const rows = await this.db.query<Array<{
      id: string;
      user_id: string;
      display_name: string;
      place_label: string;
      audience: 'friends' | 'nearby';
      location_h3_r7: string;
      created_at: Date;
    }>>(
      `SELECT ci.id,
              ci.user_id,
              u.display_name,
              ci.place_label,
              ci.audience,
              ci.location_h3_r7,
              ci.created_at
         FROM pulse_check_ins ci
         JOIN users u ON u.id = ci.user_id AND u.deleted_at IS NULL
        WHERE ci.deleted_at IS NULL
          AND ci.expires_at > NOW()
          AND ci.created_at > $2
          AND ci.location_h3_r7 = ANY($3::text[])
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = ci.user_id)
                OR (b.blocker_id = ci.user_id AND b.blocked_id = $1)
          )
          AND (
            ci.user_id = $1
            OR ci.audience = 'nearby'
            OR (
              ci.audience = 'friends'
              AND EXISTS (
                SELECT 1
                  FROM friendships f
                 WHERE (f.user_low_id = $1 AND f.user_high_id = ci.user_id)
                    OR (f.user_low_id = ci.user_id AND f.user_high_id = $1)
              )
            )
          )
        ORDER BY ci.created_at DESC
        LIMIT $4`,
      [userId, since.toISOString(), cells, Math.min(limit * 3, 300)],
    );

    return rows
      .map((row): ActivityItem => {
        const distanceM = this.distanceBetweenCellsM(viewer.location_h3_r7!, row.location_h3_r7);
        return {
          id: `place:${row.id}`,
          type: 'place',
          category: null,
          title: row.place_label,
          preview: row.audience === 'friends' ? 'Shared with friends' : 'Shared nearby',
          actorId: row.user_id,
          actorName: row.display_name,
          distanceM,
          createdAt: new Date(row.created_at).toISOString(),
          unread: false,
          narrative: {
            kind: 'place_visit',
            verb: 'visited',
            objectLabel: row.place_label,
            placeLabel: null,
          },
          deepLink: { screen: 'Main', params: { screen: 'Map' } },
        };
      })
      .filter((item) => item.distanceM != null && item.distanceM <= MAX_DISTANCE_M)
      .slice(0, limit);
  }

  private async selectEventJoins(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<ActivityItem[]> {
    const [viewer] = await this.db.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!viewer?.location_h3_r7) return [];

    const [lat, lng] = h3.cellToLatLng(viewer.location_h3_r7);
    const rows = await this.db.query<Array<{
      event_id: string;
      event_title: string;
      host_id: string;
      user_id: string;
      display_name: string;
      pulse_shared_at: Date;
      distance_m: number;
    }>>(
      `SELECT e.id AS event_id,
              e.title AS event_title,
              e.host_id,
              a.user_id,
              u.display_name,
              a.pulse_shared_at,
              ST_Distance(
                e.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
              ) AS distance_m
         FROM event_attendees a
         JOIN events e ON e.id = a.event_id
         JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
        WHERE a.status = 'going'
          AND a.pulse_shared_at IS NOT NULL
          AND a.pulse_shared_at > $4
          AND e.deleted_at IS NULL
          AND e.visibility = 'public'
          AND e.starts_at > NOW()
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = a.user_id)
                OR (b.blocker_id = a.user_id AND b.blocked_id = $1)
          )
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks hb
             WHERE (hb.blocker_id = $1 AND hb.blocked_id = e.host_id)
                OR (hb.blocker_id = e.host_id AND hb.blocked_id = $1)
          )
          AND ST_DWithin(
                e.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                $5
              )
        ORDER BY a.pulse_shared_at DESC
        LIMIT $6`,
      [userId, lng, lat, since.toISOString(), MAX_DISTANCE_M, Math.min(limit * 3, 300)],
    );

    return rows.map((row): ActivityItem => ({
      id: `event_join:${row.event_id}:${row.user_id}`,
      type: 'event',
      category: null,
      title: row.event_title,
      preview: 'Shared an event RSVP',
      actorId: row.user_id,
      actorName: row.display_name,
      distanceM: Math.round(Number(row.distance_m)),
      createdAt: new Date(row.pulse_shared_at).toISOString(),
      unread: false,
      narrative: {
        kind: 'event_joined',
        verb: 'joined',
        objectLabel: row.event_title,
        placeLabel: null,
      },
      deepLink: { screen: 'EventDetail', params: { eventId: row.event_id } },
    }));
  }

  private distanceBetweenCellsM(leftCell: string, rightCell: string): number {
    const [leftLat, leftLng] = h3.cellToLatLng(leftCell);
    const [rightLat, rightLng] = h3.cellToLatLng(rightCell);
    const toRadians = (value: number): number => value * Math.PI / 180;
    const latDelta = toRadians(rightLat - leftLat);
    const lngDelta = toRadians(rightLng - leftLng);
    const leftLatRad = toRadians(leftLat);
    const rightLatRad = toRadians(rightLat);
    const sinLat = Math.sin(latDelta / 2);
    const sinLng = Math.sin(lngDelta / 2);
    const a = sinLat * sinLat
      + Math.cos(leftLatRad) * Math.cos(rightLatRad) * sinLng * sinLng;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(6_371_000 * c);
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
