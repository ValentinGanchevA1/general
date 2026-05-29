import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { GeofenceResponse } from '@g88/shared';

import { CreateGeofenceDto } from './dto';

@Injectable()
export class GeofencesService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Upsert a geofence anchored at the caller's current fuzzed location.
   * If the user has no location on record yet the call fails with 422 — they
   * need to open the map first so the heartbeat fires.
   */
  async upsert(userId: string, dto: CreateGeofenceDto): Promise<GeofenceResponse> {
    const label = dto.label ?? 'home';
    const radiusRings = dto.radiusRings ?? 1;

    const [user] = await this.db.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!user?.location_h3_r7) {
      throw new UnprocessableEntityException(
        'Your location has not been recorded yet. Open the map to share your location.',
      );
    }

    const centerH3R7 = user.location_h3_r7;

    const [row] = await this.db.query<Array<{
      id: string; label: string; center_h3_r7: string;
      radius_rings: number; active: boolean; created_at: Date;
    }>>(
      `INSERT INTO geofences (user_id, label, center_h3_r7, radius_rings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, center_h3_r7)
       DO UPDATE SET label        = EXCLUDED.label,
                     radius_rings = EXCLUDED.radius_rings,
                     active       = true,
                     updated_at   = NOW()
       RETURNING id, label, center_h3_r7, radius_rings, active, created_at`,
      [userId, label, centerH3R7, radiusRings],
    );

    const inside = this.isInside(centerH3R7, radiusRings, centerH3R7);
    return toResponse(row!, inside);
  }

  /**
   * Return all active geofences for the user, each annotated with whether their
   * current H3 r7 cell falls within the geofence's disk.
   */
  async getActive(userId: string): Promise<GeofenceResponse[]> {
    const rows = await this.db.query<Array<{
      id: string; label: string; center_h3_r7: string;
      radius_rings: number; active: boolean; created_at: Date;
    }>>(
      `SELECT g.id, g.label, g.center_h3_r7, g.radius_rings, g.active, g.created_at
         FROM geofences g
        WHERE g.user_id = $1
          AND g.active = true
        ORDER BY g.created_at DESC`,
      [userId],
    );

    if (rows.length === 0) return [];

    const [user] = await this.db.query<Array<{ location_h3_r7: string | null }>>(
      `SELECT location_h3_r7 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    const currentCell = user?.location_h3_r7 ?? null;

    return rows.map((row) =>
      toResponse(row, this.isInside(row.center_h3_r7, row.radius_rings, currentCell)),
    );
  }

  private isInside(
    centerH3R7: string,
    radiusRings: number,
    currentCell: string | null,
  ): boolean {
    if (!currentCell) return false;
    const disk = new Set(h3.gridDisk(centerH3R7, radiusRings));
    return disk.has(currentCell);
  }
}

function toResponse(
  row: {
    id: string; label: string; center_h3_r7: string;
    radius_rings: number; active: boolean; created_at: Date;
  },
  inside: boolean,
): GeofenceResponse {
  return {
    id: row.id,
    label: row.label,
    centerH3R7: row.center_h3_r7,
    radiusRings: row.radius_rings,
    active: row.active,
    inside,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
