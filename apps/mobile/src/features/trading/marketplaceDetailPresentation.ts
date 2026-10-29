import type { MarketplaceKind } from '@g88/shared';

const LABELS: Record<MarketplaceKind, string> = {
  for_sale: 'For Sale',
  service: 'Service',
  job: 'Job',
  local_deal: 'Local Deal',
};

export function marketplaceKindLabel(kind: MarketplaceKind | null): string | null {
  return kind == null ? null : LABELS[kind];
}

export function marketplacePricePrefix(kind: MarketplaceKind | null): string {
  return kind === 'service' ? 'From ' : '';
}
