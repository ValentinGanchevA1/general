// apps/mobile/src/lib/analytics.ts
//
// Diagnostic breadcrumbs and first-party product analytics share one entry
// point, but only explicit product events leave the device. Arbitrary track()
// calls remain Sentry breadcrumbs and are never uploaded to the analytics table.

import axios from 'axios';
import * as Sentry from '@sentry/react-native';
import type {
  ProductAnalyticsEventName,
  ProductAnalyticsIngestRequest,
  ProductAnalyticsProperties,
} from '@g88/shared';

import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

const REDACTED_KEYS = new Set([
  'userId', 'user_id',
  'toUserId', 'fromUserId', 'peerUserId', 'senderId', 'recipientId',
  'email',
  'phone',
  'token', 'accessToken', 'refreshToken', 'access_token', 'refresh_token',
  'lat', 'lng', 'latitude', 'longitude',
  'password',
]);

const ENTITY_TYPES = new Set(['person', 'event', 'listing']);
const SURFACES = new Set(['map', 'discover', 'pulse', 'profile', 'detail']);
const RSVP_STATUSES = new Set(['going', 'maybe', 'declined']);
const CONNECTION_MECHANISMS = new Set(['wave', 'friend', 'dating']);
const SESSION_PATHS = new Set(['map', 'non_map']);

/** True when the key is an exact match or a *Id / *Token / *Email suffix that looks PII-ish. */
function shouldRedactKey(key: string): boolean {
  if (REDACTED_KEYS.has(key)) return true;
  if (/(?:^|[A-Z])(?:userId|UserId)$/.test(key)) return true;
  if (key.endsWith('Token') || key.endsWith('_token')) return true;
  if (key.toLowerCase().includes('password')) return true;
  return false;
}

function redact(props: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = shouldRedactKey(k) ? '[redacted]' : v;
  }
  return out;
}

function pickString(
  props: AnalyticsProps,
  key: string,
  allowed: ReadonlySet<string>,
): string | undefined {
  const value = props[key];
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeApiPath(url: string | undefined): string {
  if (!url) return '';
  const withoutQuery = url.split('?')[0] ?? '';
  return withoutQuery
    .replace(/^https?:\/\/[^/]+\/api\/v1/, '')
    .replace(/^\/api\/v1/, '');
}

function entityTypeFromDetailPath(path: string): 'person' | 'event' | 'listing' | null {
  if (/^\/users\/[^/]+$/.test(path)) return 'person';
  if (/^\/events\/[^/]+$/.test(path)) return 'event';
  if (/^\/listings\/[^/]+$/.test(path)) return 'listing';
  return null;
}

export function sanitizeProductAnalyticsProperties(
  event: ProductAnalyticsEventName,
  props: AnalyticsProps = {},
): ProductAnalyticsProperties {
  const out: ProductAnalyticsProperties = {};
  switch (event) {
    case 'app.session_started': {
      const path = pickString(props, 'path', SESSION_PATHS);
      if (path) out.path = path;
      return out;
    }
    case 'entity.opened': {
      const entityType = pickString(props, 'entityType', ENTITY_TYPES);
      const surface = pickString(props, 'surface', SURFACES);
      if (entityType) out.entityType = entityType;
      if (surface) out.surface = surface;
      return out;
    }
    case 'interaction.wave_sent': {
      if (typeof props.mutual === 'boolean') out.mutual = props.mutual;
      const surface = pickString(props, 'surface', SURFACES);
      if (surface) out.surface = surface;
      return out;
    }
    case 'event.rsvp_confirmed': {
      const status = pickString(props, 'status', RSVP_STATUSES);
      if (status) out.status = status;
      return out;
    }
    case 'connection.created': {
      const mechanism = pickString(props, 'mechanism', CONNECTION_MECHANISMS);
      if (mechanism) out.mechanism = mechanism;
      return out;
    }
    case 'marketplace.offer_sent':
    case 'chat.message_sent':
      return out;
  }
}

/**
 * Pure mapping from successful REST calls to product events. URL identifiers are
 * used only for route matching and never copied into analytics properties.
 */
export function productEventsForApiSuccess(
  method: string | undefined,
  url: string | undefined,
  data: unknown,
): ProductAnalyticsIngestRequest[] {
  const verb = method?.toLowerCase() ?? '';
  const path = normalizeApiPath(url);

  if (verb === 'get') {
    const entityType = entityTypeFromDetailPath(path);
    if (entityType) {
      return [{ event: 'entity.opened', properties: { entityType } }];
    }
  }

  if (verb === 'post' && path === '/interactions/wave') {
    const response = asRecord(data);
    const mutual = response && Object.prototype.hasOwnProperty.call(response, 'conversationId')
      ? response.conversationId != null
      : undefined;
    const events: ProductAnalyticsIngestRequest[] = [
      {
        event: 'interaction.wave_sent',
        properties: mutual === undefined ? {} : { mutual },
      },
    ];
    if (mutual === true) {
      events.push({ event: 'connection.created', properties: { mechanism: 'wave' } });
    }
    return events;
  }

  if (verb === 'post' && /^\/friends\/requests\/[^/]+\/accept$/.test(path)) {
    return [{ event: 'connection.created', properties: { mechanism: 'friend' } }];
  }

  if (verb === 'post' && path === '/dating/likes') {
    const response = asRecord(data);
    return response?.matched === true
      ? [{ event: 'connection.created', properties: { mechanism: 'dating' } }]
      : [];
  }

  if (verb === 'put' && /^\/events\/[^/]+\/rsvp$/.test(path)) {
    const response = asRecord(data);
    const status = typeof response?.status === 'string' && RSVP_STATUSES.has(response.status)
      ? response.status
      : undefined;
    return [{
      event: 'event.rsvp_confirmed',
      properties: status ? { status } : {},
    }];
  }

  if (verb === 'post' && /^\/listings\/[^/]+\/offers$/.test(path)) {
    return [{ event: 'marketplace.offer_sent', properties: {} }];
  }

  return [];
}

async function uploadProductEvent(payload: ProductAnalyticsIngestRequest): Promise<void> {
  const accessToken = await tokenStore.getAccessToken();
  if (!accessToken) return;

  await axios.post(
    `${Config.API_BASE_URL}/api/v1/analytics/events`,
    payload,
    {
      timeout: 3_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

/**
 * Fire-and-forget first-party analytics. This intentionally bypasses the main
 * API client so analytics failures cannot trigger refresh/logout or recursively
 * generate analytics events.
 */
export function trackProduct(
  event: ProductAnalyticsEventName,
  props: AnalyticsProps = {},
): void {
  const payload: ProductAnalyticsIngestRequest = {
    event,
    properties: sanitizeProductAnalyticsProperties(event, props),
  };
  void uploadProductEvent(payload).catch(() => undefined);
}

export function trackSuccessfulProductApiCall(
  method: string | undefined,
  url: string | undefined,
  data: unknown,
): void {
  for (const payload of productEventsForApiSuccess(method, url, data)) {
    trackProduct(payload.event, payload.properties ?? {});
  }
}

export function track(event: string, props: AnalyticsProps = {}): void {
  const safe = redact(props);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, safe);
  }

  Sentry.addBreadcrumb({ category: 'analytics', message: event, data: safe, level: 'info' });

  // Existing launch telemetry is the canonical once-per-launch retention signal.
  // Only its coarse map/non-map path is forwarded; timing/device details stay in Sentry.
  if (event === 'nexa_launch_complete') {
    trackProduct('app.session_started', {
      path: safe.path === 'map' ? 'map' : 'non_map',
    });
  }
}
