// apps/mobile/src/lib/analytics.ts
//
// Single entry point for client-side analytics. Swap impl when OB1 (Sentry)
// lands — call sites stay stable.

export type AnalyticsProps = Record<string, string | number | boolean | null>;

const REDACTED_KEYS = new Set([
  'userId', 'user_id',
  'email',
  'phone',
  'token', 'accessToken', 'refreshToken', 'access_token', 'refresh_token',
  'lat', 'lng', 'latitude', 'longitude',
  'password',
]);

function redact(props: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = REDACTED_KEYS.has(k) ? '[redacted]' : v;
  }
  return out;
}

export function track(event: string, props: AnalyticsProps = {}): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, redact(props));
  }
  // TODO(OB1): Sentry.addBreadcrumb({ category: 'analytics', message: event, data: redact(props) });
}
