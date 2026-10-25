// apps/mobile/src/lib/analytics.ts
//
// Diagnostic breadcrumbs and first-party product analytics share one entry
// point, but only explicit product events leave the device. Arbitrary track()
// calls remain Sentry breadcrumbs and are never uploaded to the analytics table.

import * as Sentry from '@sentry/react-native';
import type {
  ProductAnalyticsEventName,
  ProductAnalyticsIngestRequest,
  ProductAnalyticsProperties,
} from '@g88/shared';

import { api } from '@/api/client';

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

export function sanitizeProductAnalyticsProperties(
  event: ProductAnalyticsEventName,
  props: AnalyticsProps = {},
): ProductAnalyticsProperties {
  const out: ProductAnalyticsProperties = {};
  switch (event) {
    case 'app.session_started': {
      const path = pickString(props, 'path', new Set(['map', 'non_map']));
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
 * Fire-and-forget first-party analytics. Product behavior must never depend on
 * analytics availability; the server still authenticates, rate-limits and
 * applies its own property allow-list.
 */
export function trackProduct(
  event: ProductAnalyticsEventName,
  props: AnalyticsProps = {},
): void {
  const payload: ProductAnalyticsIngestRequest = {
    event,
    properties: sanitizeProductAnalyticsProperties(event, props),
  };
  void api.post('/analytics/events', payload).catch(() => undefined);
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
