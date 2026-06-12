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
