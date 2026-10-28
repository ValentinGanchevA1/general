import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { NexaPlaceSaveState } from '@g88/shared';

import { PlaceCatalogService } from './place-catalog.service';

interface ExistsRow {
  saved: boolean;
}

@Injectable()
export class PlaceSaveService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly places: PlaceCatalogService,
  ) {}

  async getState(userId: string, requestedPlaceId: string): Promise<NexaPlaceSaveState | null> {
    const place = await this.places.getActivePlace(requestedPlaceId);
    if (!place) return null;

    const [row] = await this.db.query<ExistsRow[]>(
      `WITH RECURSIVE aliases(id) AS (
         SELECT id
           FROM nexa_places
          WHERE id = $2
         UNION ALL
         SELECT p.id
           FROM nexa_places p
           JOIN aliases a ON p.merged_into_place_id = a.id
          WHERE p.status = 'merged'
       )
       SELECT EXISTS (
         SELECT 1
           FROM nexa_place_saves s
          WHERE s.user_id = $1
            AND s.place_id IN (SELECT id FROM aliases)
       ) AS saved`,
      [userId, place.id],
    );

    return { placeId: place.id, saved: row?.saved === true };
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
        `WITH RECURSIVE aliases(id) AS (
           SELECT id
             FROM nexa_places
            WHERE merged_into_place_id = $2
           UNION ALL
           SELECT p.id
             FROM nexa_places p
             JOIN aliases a ON p.merged_into_place_id = a.id
            WHERE p.status = 'merged'
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
      `WITH RECURSIVE aliases(id) AS (
         SELECT id
           FROM nexa_places
          WHERE id = $2
         UNION ALL
         SELECT p.id
           FROM nexa_places p
           JOIN aliases a ON p.merged_into_place_id = a.id
          WHERE p.status = 'merged'
       )
       DELETE FROM nexa_place_saves
        WHERE user_id = $1
          AND place_id IN (SELECT id FROM aliases)`,
      [userId, place.id],
    );

    return { placeId: place.id, saved: false };
  }
}
