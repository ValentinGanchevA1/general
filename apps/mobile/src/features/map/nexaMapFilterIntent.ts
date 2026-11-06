import type { DiscoveryRankBy, EntityKind } from '@g88/shared';
import type { NexaSpatialLens } from './nexaSpatialLens.store';
import type { ListingModeFilterValue } from '@/components/map/MapFilterRow';
import type { MarketplaceKindMapFilterValue } from './marketplaceKindMapFilter.store';

/**
 * Pure projection of MapScreen's current manual settings. This function does
 * not move the map or expose filter values to the Fusion screen.
 *
 * Defaults must match the live map stores:
 * - Public Places ON (publicPlacesMapLayerStore's default)
 * - Saved Places OFF
 * - Marketplace taxonomy ALL
 * - Default entity layers come from MapFilterRow
 */
export interface MapManualFilterValues {
  activeLens: NexaSpatialLens;
  customLayers: readonly EntityKind[];
  defaultLayers: readonly EntityKind[];
  listingModeFilter: ListingModeFilterValue;
  friendsOnly: boolean;
  datingOnly: boolean;
  rankBy: DiscoveryRankBy;
  searchQuery: string;
  marketplaceKind: MarketplaceKindMapFilterValue;
  publicPlacesVisible: boolean;
  savedPlacesVisible: boolean;
}

export function hasManualMapFilterChanges(input: MapManualFilterValues): boolean {
  const layersChanged =
    input.customLayers.length !== input.defaultLayers.length ||
    input.customLayers.some((kind) => !input.defaultLayers.includes(kind));

  return input.activeLens === 'custom' ||
    layersChanged ||
    input.listingModeFilter !== 'all' ||
    input.friendsOnly ||
    input.datingOnly ||
    input.rankBy !== 'relevance' ||
    input.searchQuery.trim().length > 0 ||
    input.marketplaceKind !== 'all' ||
    !input.publicPlacesVisible ||
    input.savedPlacesVisible;
}
