import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { FeedResponse } from '@g88/shared';

interface PlaceActivityLinkRow {
  activity_id: string;
  place_id: string;
}

/** Adds NEXA-owned place identity to REST Pulse activity without changing socket v1. */
@Injectable()
export class PlaceActivityLinkService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async enrich(response: FeedResponse): Promise<FeedResponse> {
    const checkInIds: string[] = [];
    const trendIds: string[] = [];

    for (const item of response.items) {
      if (item.type !== 'place') continue;
      if (item.id.startsWith('place_trending:')) {
        trendIds.push(item.id.slice('place_trending:'.length));
      } else if (item.id.startsWith('place:')) {
        checkInIds.push(item.id.slice('place:'.length));
      }
    }

    if (checkInIds.length === 0 && trendIds.length === 0) return response;

    const rows = await this.db.query<PlaceActivityLinkRow[]>(
      `SELECT 'place:' || ci.id::text AS activity_id, ci.place_id
         FROM pulse_check_ins ci
        WHERE ci.place_id IS NOT NULL
          AND ci.id = ANY($1::uuid[])
       UNION ALL
       SELECT 'place_trending:' || t.id::text AS activity_id, t.place_id
         FROM pulse_place_trends t
        WHERE t.place_id IS NOT NULL
          AND t.id = ANY($2::uuid[])`,
      [checkInIds, trendIds],
    );

    const placeByActivityId = new Map(rows.map((row) => [row.activity_id, row.place_id]));
    return {
      ...response,
      items: response.items.map((item) => {
        if (item.type !== 'place') return item;
        const placeId = placeByActivityId.get(item.id) ?? null;
        if (!placeId) return { ...item, placeId: null };
        return {
          ...item,
          placeId,
          deepLink: { screen: 'PlaceDetail', params: { placeId } },
        };
      }),
    };
  }
}
