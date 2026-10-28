import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { PlaceMapEntityPoint } from '@g88/shared';

import { NexaPlaceSheet } from '@/components/map/NexaSpatialEntitySheets';
import type { NexaSpatialMetaItem } from '@/components/map/NexaSpatialSheet';
import { sharePlace } from '@/features/places/sharePlace';
import { useAppTheme } from '@/theme';

export function PlaceMapPreviewSheet({
  point,
  onCheckIn,
  onToggleSaved,
  onViewDetails,
  saveLoading,
  saveError,
}: {
  point: PlaceMapEntityPoint;
  onCheckIn: () => void;
  onToggleSaved: () => void;
  onViewDetails: () => void;
  saveLoading: boolean;
  saveError: string | null;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const meta = useMemo<NexaSpatialMetaItem[]>(() => {
    const items: NexaSpatialMetaItem[] = [
      {
        id: 'precision',
        label: 'Approximate area',
        icon: 'shield-map-outline',
      },
    ];
    if (point.meta.trending) {
      items.unshift({
        id: 'activity',
        label: 'Getting active nearby',
        icon: 'pulse',
        emphasis: true,
      });
    } else {
      items.unshift({
        id: 'activity',
        label: 'Local place',
        icon: 'map-marker-outline',
      });
    }
    if (point.meta.saved === true) {
      items.push({ id: 'saved', label: 'Saved', icon: 'bookmark' });
    }
    return items;
  }, [point.meta.saved, point.meta.trending]);

  const saved = point.meta.saved === true;
  const share = (): void => {
    void sharePlace({ id: point.id, canonicalLabel: point.meta.canonicalLabel }).catch(() => undefined);
  };

  return (
    <NexaPlaceSheet
      title={point.meta.canonicalLabel}
      subtitle="NEXA shows only a coarse map area for this place."
      meta={meta}
      primaryAction={{
        id: 'check-in',
        label: 'Check in',
        icon: 'map-marker-check-outline',
        onPress: onCheckIn,
        accessibilityLabel: `Check in at ${point.meta.canonicalLabel}`,
      }}
      secondaryActions={[
        {
          id: 'save',
          label: saved ? 'Saved' : 'Save',
          icon: saved ? 'bookmark' : 'bookmark-outline',
          onPress: onToggleSaved,
          disabled: saveLoading,
          loading: saveLoading,
          variant: saved ? 'quiet' : 'secondary',
          accessibilityLabel: saved
            ? `Remove ${point.meta.canonicalLabel} from saved places`
            : `Save ${point.meta.canonicalLabel}`,
        },
        {
          id: 'share',
          label: 'Share',
          icon: 'share-variant-outline',
          onPress: share,
          variant: 'quiet',
          accessibilityLabel: `Share ${point.meta.canonicalLabel}`,
        },
        {
          id: 'details',
          label: 'Details',
          icon: 'arrow-expand',
          onPress: onViewDetails,
          accessibilityLabel: `View details for ${point.meta.canonicalLabel}`,
        },
      ]}
      accessibilityLabel={`${point.meta.canonicalLabel}, place, approximate location${point.meta.trending ? ', getting active nearby' : ''}${saved ? ', saved' : ''}`}
      testID="place-map-preview-sheet"
    >
      {saveError ? (
        <Text
          style={[styles.saveError, { color: colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {saveError}
        </Text>
      ) : null}
    </NexaPlaceSheet>
  );
}

const styles = StyleSheet.create({
  saveError: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
