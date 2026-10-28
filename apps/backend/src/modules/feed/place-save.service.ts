import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { NexaPlaceSaveState, NexaSavedPlacesPage, NexaSavedPlaceSummary } from '@g88/shared';

import { PlaceCatalogService } from './place-catalog.service';

interface ExistsRow {
  saved: boolean;
}

interface SavedPlaceRow {
  id: string;
  canonical_label: string;
  location_h3_r7: string;
  saved_at: Date;
  last_emitted_at: Date | null;
}

@Injectable()
export class PlaceSaveService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly places: PlaceCatalogService,
  ) {}

  async isSavedCanonicalPlace(userId: string, canonicalPlaceId: string): Promise<boolean> {
    const [row] = await this.db.query<ExistsRow[]>(
      `WITH RECURSIVE aliases(id, depth) AS (
         SELECT id, 0
           FROM nexa_places
          WHERE id = $2
         UNION ALL
         SELECT p.id, a.depth + 1
           FROM nexa_places p
           JOIN aliases a ON p.merged_into_place_id = a.id
          WHERE p.status = 'merged'
            AND a.depth < 5
       )
       SELECT EXISTS (
         SELECT 1
           FROM nexa_place_saves s
          WHERE s.user_id = $1
            AND s.place_id IN (SELECT id FROM aliases)
       ) AS saved`,
      [userId, canonicalPlaceId],
    );
    return row?.saved === true;
  }

  async listSaved(userId: string, requestedLimit: number, requestedOffset: number): Promise<NexaSavedPlacesPage> {
    const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 50));
    const offset = Math.max(0, Math.min(Math.trunc(requestedOffset), 5_000));
    const rows = await this.db.query<SavedPlaceRow[]>(
      `WITH RECURSIVE save_chain(saved_place_id, current_place_id, saved_at, depth) AS (
         SELECT s.place_id, s.place_id, s.created_at, 0
           FROM nexa_place_saves s
          WHERE s.user_id = $1
         UNION ALL
         SELECT c.saved_place_id, p.merged_into_place_id, c.saved_at, c.depth + 1
           FROM save_chain c
           JOIN nexa_places p ON p.id = c.current_place_id
          WHERE p.status = 'merged'
            AND p.merged_into_place_id IS NOT NULL
            AND c.depth < 5
       ),
       resolved AS (
         SELECT c.saved_place_id,
                c.current_place_id AS place_id,
                c.saved_at
           FROM save_chain c
           JOIN nexa_places p ON p.id = c.current_place_id
          WHERE p.status = 'active'
       ),
       canonical AS (
         SELECT place_id, MAX(saved_at) AS saved_at
           FROM resolved
          GROUP BY place_id
       )
       SELECT p.id,
              p.canonical_label,
              p.location_h3_r7,
              c.saved_at,
              trend.last_emitted_at
         FROM canonical c
         JOIN nexa_places p ON p.id = c.place_id AND p.status = 'active'
         LEFT JOIN LATERAL (
           SELECT t.last_emitted_at
             FROM pulse_place_trends t
            WHERE t.place_id = p.id
              AND t.expires_at > NOW()
            ORDER BY t.last_emitted_at DESC
            LIMIT 1
         ) trend ON TRUE
        ORDER BY c.saved_at DESC, p.id ASC
        LIMIT $2 OFFSET $3`,
      [userId, limit + 1, offset],
    );

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items: NexaSavedPlaceSummary[] = [];
    for (const row of pageRows) {
      if (!h3.isValidCell(row.location_h3_r7) || h3.getResolution(row.location_h3_r7) !== 7) continue;
      const [lat, lng] = h3.cellToLatLng(row.location_h3_r7);
      items.push({
        id: row.id,
        canonicalLabel: row.canonical_label,
        approximateLocation: { lat, lng },
        locationPrecision: 'coarse',
        trending: row.last_emitted_at != null,
        recentActivityAt: row.last_emitted_at ? new Date(row.last_emitted_at).toISOString() : null,
        savedAt: new Date(row.saved_at).toISOString(),
      });
    }

    return {
      items,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async getState(userId: string, requestedPlaceId: string): Promise<NexaPlaceSaveState | null> {
    const place = await this.places.getActivePlace(requestedPlaceId);
    if (!place) return null;
    return {
      placeId: place.id,
      saved: await this.isSavedCanonicalPlace(userId, place.id),
    };
  }

  async save(userId: string, requestedPlaceId: string): Promise<NexaPlaceSaveState | null> {
    const place = await this.places.getActivePlace(requestedPlaceId);
    if (!place) return null;

    await this.db.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO nexa_place_saves (user_id, place_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, place_id) DO NOTHING`,
        [userId, place.id],
      );
      await manager.query(
        `WITH RECURSIVE aliases(id, depth) AS (
           SELECT id, 1
             FROM nexa_places
            WHERE merged_into_place_id = $2
           UNION ALL
           SELECT p.id, a.depth + 1
             FROM nexa_places p
             JOIN aliases a ON p.merged_into_place_id = a.id
            WHERE p.status = 'merged'
              AND a.depth < 5
         )
         DELETE FROM nexa_place_saves
          WHERE user_id = $1
            AND place_id IN (SELECT id FROM aliases)`,
        [userId, place.id],
      );
    });

    return { placeId: place.id, saved: true };
  }

  async unsave(userId: string, requestedPlaceId: string): Promise<NexaPlaceSaveState | null> {
    const place = await this.places.getActivePlace(requestedPlaceId);
    if (!place) return null;

    await this.db.query(
      `WITH RECURSIVE aliases(id, depth) AS (
         SELECT id, 0
           FROM nexa_places
          WHERE id = $2
         UNION ALL
         SELECT p.id, a.depth + 1
           FROM nexa_places p
           JOIN aliases a ON p.merged_into_place_id = a.id
          WHERE p.status = 'merged'
            AND a.depth < 5
       )
       DELETE FROM nexa_place_saves
        WHERE user_id = $1
          AND place_id IN (SELECT id FROM aliases)`,
      [userId, place.id],
    );

    return { placeId: place.id, saved: false };
  }
}
