import { Injectable } from '@nestjs/common';
import * as h3 from 'h3-js';

import {
  computeH3Cells,
  type PlaceIdentity,
} from '@g88/shared';

const MAPTILER_FEATURE_ID_PATTERN = /^\S+\.[0-9]+$/;
const OSM_REF_PATTERN = /^osm:([nwr][0-9]+)$/;
const MAX_FEATURE_ID_LENGTH = 200;
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 2_500;
const MAX_PLACE_CELL_DISTANCE = 2;

interface MapTilerFeatureCollection {
  features: unknown[];
}

interface LatLng {
  lat: number;
  lng: number;
}

export interface AttestedPlaceExternalRef {
  namespace: 'osm';
  externalId: string;
}

export interface AttestedPlace {
  identity: PlaceIdentity;
  stableExternalRef: AttestedPlaceExternalRef | null;
}

/**
 * Resolves client-selected MapTiler feature IDs on the backend before a
 * check-in may be treated as canonical. Client-supplied labels/coordinates are
 * never trusted for persistence or trend aggregation.
 *
 * Attestation is deliberately fail-soft: stale IDs, provider outages, missing
 * server configuration, or area mismatches downgrade the check-in to free text
 * instead of blocking the user's check-in.
 */
@Injectable()
export class MapTilerPlaceAttestationService {
  async attest(input: PlaceIdentity, userCellH3R7: string): Promise<AttestedPlace | null> {
    if (input.provider !== 'maptiler') return null;

    const providerPlaceId = input.providerPlaceId.trim();
    if (!this.isValidFeatureId(providerPlaceId)) return null;

    const apiKey = (process.env.NEXA_MAPTILER_SERVER_API_KEY ?? '').trim();
    if (!apiKey) return null;

    const feature = await this.fetchFeature(providerPlaceId, apiKey);
    if (!feature) return null;

    const canonicalLabel = this.readCanonicalLabel(feature);
    const center = this.readCenter(feature);
    if (!canonicalLabel || !center) return null;

    const providerCellH3R7 = computeH3Cells(center.lat, center.lng).r7;
    if (!this.isNearby(userCellH3R7, providerCellH3R7)) return null;

    return {
      identity: {
        provider: 'maptiler',
        providerPlaceId,
        canonicalLabel,
        providerCellH3R7,
      },
      stableExternalRef: this.readStableExternalRef(feature),
    };
  }

  private async fetchFeature(
    providerPlaceId: string,
    apiKey: string,
  ): Promise<Record<string, unknown> | null> {
    const origin = process.env.NEXA_MAPTILER_REGION === 'global'
      ? 'https://api.maptiler.com'
      : 'https://api.maptiler.eu';
    const url = `${origin}/geocoding/${encodeURIComponent(providerPlaceId)}.json?key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return null;

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) return null;

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) return null;

      const payload: unknown = JSON.parse(text);
      if (!this.isFeatureCollection(payload)) return null;

      for (const value of payload.features) {
        if (!this.isRecord(value)) continue;
        if (value.id === providerPlaceId) return value;
      }
      return null;
    } catch {
      return null;
    }
  }

  private readCanonicalLabel(feature: Record<string, unknown>): string | null {
    const text = typeof feature.text === 'string'
      ? feature.text
      : typeof feature.place_name === 'string'
        ? feature.place_name
        : '';
    const normalized = text.trim().split(/\s+/u).join(' ');
    if (normalized.length < 2 || normalized.length > 80 || this.hasControlCharacters(normalized)) {
      return null;
    }
    return normalized;
  }

  private readStableExternalRef(feature: Record<string, unknown>): AttestedPlaceExternalRef | null {
    if (!this.isRecord(feature.properties) || typeof feature.properties.ref !== 'string') return null;
    const match = OSM_REF_PATTERN.exec(feature.properties.ref.trim());
    if (!match?.[1]) return null;
    return { namespace: 'osm', externalId: match[1] };
  }

  private readCenter(feature: Record<string, unknown>): LatLng | null {
    const fromCenter = this.readLngLatArray(feature.center);
    if (fromCenter) return fromCenter;

    if (!this.isRecord(feature.geometry) || feature.geometry.type !== 'Point') return null;
    return this.readLngLatArray(feature.geometry.coordinates);
  }

  private readLngLatArray(value: unknown): LatLng | null {
    if (!Array.isArray(value) || value.length < 2) return null;
    const lng = value[0];
    const lat = value[1];
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  private isNearby(userCellH3R7: string, providerCellH3R7: string): boolean {
    if (!h3.isValidCell(userCellH3R7) || h3.getResolution(userCellH3R7) !== 7) return false;
    try {
      return h3.gridDistance(userCellH3R7, providerCellH3R7) <= MAX_PLACE_CELL_DISTANCE;
    } catch {
      return false;
    }
  }

  private isValidFeatureId(value: string): boolean {
    return value.length > 0
      && value.length <= MAX_FEATURE_ID_LENGTH
      && MAPTILER_FEATURE_ID_PATTERN.test(value)
      && !this.hasControlCharacters(value);
  }

  private isFeatureCollection(value: unknown): value is MapTilerFeatureCollection {
    return this.isRecord(value) && Array.isArray(value.features);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private hasControlCharacters(input: string): boolean {
    for (const char of input) {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) return true;
    }
    return false;
  }
}
