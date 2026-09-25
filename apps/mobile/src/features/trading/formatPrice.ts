// apps/mobile/src/features/trading/formatPrice.ts
//
// Cents → display price. Dependency-free (Hermes Intl) — no native money libs.

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    // Unknown currency code → plain fallback.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Human expiry for listing urgency.
 * null when no expiresAt or unparseable.
 */
export function formatListingExpiry(expiresAt: string | null | undefined): string | null {
  if (expiresAt == null || expiresAt === '') return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `Ends in ${hours}h`;
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 14) return `Ends in ${days}d`;
  try {
    return `Ends ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } catch {
    return `Ends in ${days}d`;
  }
}
