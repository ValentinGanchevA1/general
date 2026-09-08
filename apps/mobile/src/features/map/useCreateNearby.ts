import { useCallback, useState } from 'react';
import type { LongPressEvent } from 'react-native-maps';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import type { CreateNearbyAction } from '@/components/map/CreateNearbySheet';
import { openRootScreen } from '@/navigation/openRootScreen';
import { track } from '@/lib/analytics';

type LatLng = { lat: number; lng: number };

/**
 * Map long-press → CreateNearbySheet → Listing/Event/Alert create with initialLocation.
 */
export function useCreateNearby(
  navigation: NavigationProp<ParamListBase>,
  /** When an entity sheet is open, long-press is ignored. */
  sheetBlocksLongPress: boolean,
): {
  createNearbyOpen: boolean;
  setCreateNearbyOpen: (open: boolean) => void;
  onMapLongPress: (e: LongPressEvent) => void;
  onCreateNearbySelect: (action: CreateNearbyAction) => void;
} {
  const [createNearbyOpen, setCreateNearbyOpen] = useState(false);
  const [createNearbyCoords, setCreateNearbyCoords] = useState<LatLng | null>(null);

  const onMapLongPress = useCallback(
    (e: LongPressEvent): void => {
      if (sheetBlocksLongPress) return;
      const { latitude, longitude } = e.nativeEvent.coordinate;
      track('map.longpress_create', { lat: latitude, lng: longitude });
      setCreateNearbyCoords({ lat: latitude, lng: longitude });
      setCreateNearbyOpen(true);
    },
    [sheetBlocksLongPress],
  );

  const onCreateNearbySelect = useCallback(
    (action: CreateNearbyAction): void => {
      const location = createNearbyCoords;
      track('map.create_choice', { kind: action });
      const locParams = location ? { initialLocation: location } : {};
      switch (action) {
        case 'listing_sell':
          openRootScreen(navigation, 'ListingCreate', { mode: 'sell', ...locParams });
          break;
        case 'listing_buy':
          openRootScreen(navigation, 'ListingCreate', { mode: 'buy', ...locParams });
          break;
        case 'event':
          openRootScreen(navigation, 'EventCreate', locParams);
          break;
        case 'alert':
          openRootScreen(navigation, 'AlertComposer', locParams);
          break;
      }
    },
    [createNearbyCoords, navigation],
  );

  return {
    createNearbyOpen,
    setCreateNearbyOpen,
    onMapLongPress,
    onCreateNearbySelect,
  };
}
