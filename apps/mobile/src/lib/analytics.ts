// apps/mobile/src/lib/analytics.ts
//
// Single entry point for client-side analytics. Swap impl when OB1 (Sentry)
// lands — call sites stay stable.

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function track(event: string, props: AnalyticsProps = {}): void {
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, props);
  // TODO(OB1): Sentry.addBreadcrumb({ category: 'analytics', message: event, data: props });
}
