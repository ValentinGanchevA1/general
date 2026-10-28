import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import * as h3 from 'h3-js';

import type { NexaPlaceDetail } from '@g88/shared';

import type { AttestedPlace } from './maptiler-place-attestation.service';

interface PlaceRow {
  id: string;
  canonical_label: string;
  location_h3_r7: string;
  status: 'active' | 'merged';
  merged_into_place_id: string | null;
}

interface TrendRow {
  last_emitted_at: Date;
}

export interface CatalogPlace {
  id: string;
  canonicalLabel: string;
  locationH3R7: string;
}

export type NexaPlacePublicDetail = Omit<NexaPlaceDetail, 'saved'>;

/**
 * Converts short-lived provider identities into NEXA-owned durable place IDs.
 *
 * Reconciliation is intentionally conservative:
 * - known stable upstream refs win when available;
 * - known provider feature IDs are aliases;
 * - labels/H3 cells alone never cause an automatic merge.
 */
@Injectable()
export class PlaceCatalogService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async resolve(attested: AttestedPlace): Promise<CatalogPlace> {
    return this.db.transaction(async (manager) => {
      const featureRef = {
        namespace: 'maptiler',
        externalId: attested.identity.providerPlaceId,
      } as const;
      const refs = attested.stableExternalRef
        ? [featureRef, attested.stableExternalRef]
        : [featureRef];

      const lockKeys = refs
        .map((ref) => `${ref.namespace}:${ref.externalId}`)
        .sort((left, right) => left.localeCompare(right));
      for (const key of lockKeys) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      }

      const featurePlace = await this.findByRef(manager, featureRef.namespace, featureRef.externalId);
      const stablePlace = attested.stableExternalRef
        ? await this.findByRef(
            manager,
            attested.stableExternalRef.namespace,
            attested.stableExternalRef.externalId,
          )
        : null;

      if (featurePlace && stablePlace && featurePlace.id !== stablePlace.id) {
        throw new Error('Conflicting external place references.');
      }

      const existing = stablePlace ?? featurePlace;
      const place = existing
        ? await this.refreshExisting(manager, existing, attested)
        : await this.createPlace(manager, attested);

      for (const ref of refs) {
        await this.attachRef(manager, place.id, ref.namespace, ref.externalId);
      }

      return this.toCatalogPlace(place);
    });
  }

  /** Resolve merged aliases to the current active NEXA place and fail closed on invalid coarse location. */
  async getActivePlace(placeId: string): Promise<CatalogPlace | null> {
    const [initial] = await this.db.query<PlaceRow[]>(
      `SELECT id, canonical_label, location_h3_r7, status, merged_into_place_id
         FROM nexa_places
        WHERE id = $1
        LIMIT 1`,
      [placeId],
    );
    if (!initial) return null;

    let place = initial;
    for (let depth = 0; place.status === 'merged' && place.merged_into_place_id; depth += 1) {
      if (depth >= 5) return null;
      const [next] = await this.db.query<PlaceRow[]>(
        `SELECT id, canonical_label, location_h3_r7, status, merged_into_place_id
           FROM nexa_places
          WHERE id = $1
          LIMIT 1`,
        [place.merged_into_place_id],
      );
      if (!next) return null;
      place = next;
    }

    if (place.status !== 'active') return null;
    if (!h3.isValidCell(place.location_h3_r7) || h3.getResolution(place.location_h3_r7) !== 7) {
      return null;
    }

    return this.toCatalogPlace(place);
  }

  /** Public place view. Never exposes provider aliases, raw H3 or participant counts. */
  async getPublicDetail(placeId: string): Promise<NexaPlacePublicDetail | null> {
    const place = await this.getActivePlace(placeId);
    if (!place) return null;

    const [lat, lng] = h3.cellToLatLng(place.locationH3R7);
    const [trend] = await this.db.query<TrendRow[]>(
      `SELECT last_emitted_at
         FROM pulse_place_trends
        WHERE place_id = $1
          AND expires_at > NOW()
        ORDER BY last_emitted_at DESC
        LIMIT 1`,
      [place.id],
    );

    return {
      id: place.id,
      canonicalLabel: place.canonicalLabel,
      approximateLocation: { lat, lng },
      locationPrecision: 'coarse',
      trending: trend != null,
      recentActivityAt: trend ? new Date(trend.last_emitted_at).toISOString() : null,
    };
  }

  private toCatalogPlace(place: PlaceRow): CatalogPlace {
    return {
      id: place.id,
      canonicalLabel: place.canonical_label,
      locationH3R7: place.location_h3_r7,
    };
  }

  private async findByRef(
    manager: EntityManager,
    namespace: string,
    externalId: string,
  ): Promise<PlaceRow | null> {
    const [row] = await manager.query<PlaceRow[]>(
      `SELECT p.id,
              p.canonical_label,
              p.location_h3_r7,
              p.status,
              p.merged_into_place_id
         FROM nexa_place_external_refs r
         JOIN nexa_places p ON p.id = r.place_id
        WHERE r.namespace = $1
          AND r.external_id = $2
        LIMIT 1`,
      [namespace, externalId],
    );
    return row ? this.followMerge(manager, row) : null;
  }

  private async followMerge(manager: EntityManager, initial: PlaceRow): Promise<PlaceRow> {
    let current = initial;
    for (let depth = 0; depth < 5; depth += 1) {
      if (current.status === 'active' || !current.merged_into_place_id) return current;
      const [next] = await manager.query<PlaceRow[]>(
        `SELECT id, canonical_label, location_h3_r7, status, merged_into_place_id
           FROM nexa_places
          WHERE id = $1
          LIMIT 1`,
        [current.merged_into_place_id],
      );
      if (!next) throw new Error('Merged place target is missing.');
      current = next;
    }
    throw new Error('Place merge chain is too deep.');
  }

  private async refreshExisting(
    manager: EntityManager,
    existing: PlaceRow,
    attested: AttestedPlace,
  ): Promise<PlaceRow> {
    const [updated] = await manager.query<PlaceRow[]>(
      `UPDATE nexa_places
          SET canonical_label = $2,
              location_h3_r7 = $3,
              last_seen_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
      RETURNING id, canonical_label, location_h3_r7, status, merged_into_place_id`,
      [
        existing.id,
        attested.identity.canonicalLabel,
        attested.identity.providerCellH3R7,
      ],
    );
    if (!updated) throw new Error('NEXA place is not active.');
    return updated;
  }

  private async createPlace(manager: EntityManager, attested: AttestedPlace): Promise<PlaceRow> {
    const [created] = await manager.query<PlaceRow[]>(
      `INSERT INTO nexa_places
         (canonical_label, location_h3_r7, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW(), NOW())
       RETURNING id, canonical_label, location_h3_r7, status, merged_into_place_id`,
      [attested.identity.canonicalLabel, attested.identity.providerCellH3R7],
    );
    if (!created) throw new Error('Failed to create NEXA place.');
    return created;
  }

  private async attachRef(
    manager: EntityManager,
    placeId: string,
    namespace: string,
    externalId: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO nexa_place_external_refs
         (place_id, namespace, external_id, last_seen_at, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (namespace, external_id)
       DO UPDATE SET last_seen_at = NOW()`,
      [placeId, namespace, externalId],
    );
  }
}
