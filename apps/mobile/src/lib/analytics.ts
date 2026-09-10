// apps/mobile/src/lib/analytics.ts
//
// Single entry point for client-side analytics.
// Call sites stay stable; the implementation swaps between environments.

import * as Sentry from '@sentry/react-native';

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

/** True when the key is an exact match or a *Id / *Token / *Email suffix that looks PII-ish. */
function shouldRedactKey(key: string): boolean {
  if (REDACTED_KEYS.has(key)) return true;
  // camelCase role prefixes that commonly carry user identifiers
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

export function track(event: string, props: AnalyticsProps = {}): void {
  const safe = redact(props);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, safe);
  }

  // Breadcrumbs give Sentry the user's action trail leading up to an error.
  // addBreadcrumb is a no-op when Sentry is disabled (no DSN set).
  Sentry.addBreadcrumb({ category: 'analytics', message: event, data: safe, level: 'info' });
}
