import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { CheckInAudience, PlaceMapEntityPoint } from '@g88/shared';

import { NexaPlaceSheet } from '@/components/map/NexaSpatialEntitySheets';
import type { NexaSpatialMetaItem } from '@/components/map/NexaSpatialSheet';
import { useUserLocation } from '@/features/location/useUserLocation';
import { formatPlaceActivityRecency } from '@/features/places/placeActivityRecency';
import {
  clearCheckInError,
  createPlacePulseCheckIn,
} from '@/features/pulse/pulseSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { sharePlace } from '@/features/places/sharePlace';
import { useAppTheme, type ThemeColors } from '@/theme';

export function PlaceMapPreviewSheet({
  point,
  onCheckIn,
  onToggleSaved,
  onViewDetails,
  saveLoading,
  saveError,
}: {
  point: PlaceMapEntityPoint;
  /** Full-detail fallback used only when an inline map check-in fails. */
  onCheckIn: () => void;
  onToggleSaved: () => void;
  onViewDetails: () => void;
  saveLoading: boolean;
  saveError: string | null;
}): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { getCurrentLocation } = useUserLocation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { checkInSubmitting, checkInError } = useAppSelector((state) => state.pulse);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkedInPlaceId, setCheckedInPlaceId] = useState<string | null>(null);
  const checkedIn = checkedInPlaceId === point.id;

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
        label:
          formatPlaceActivityRecency(
            point.meta.trending,
            point.meta.recentActivityAt,
          ) ?? 'Getting active nearby',
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
    if (checkedIn) {
      items.push({ id: 'checked-in', label: 'Checked in', icon: 'check-circle' });
    }
    return items;
  }, [checkedIn, point.meta.recentActivityAt, point.meta.saved, point.meta.trending]);

  const saved = point.meta.saved === true;
  const share = (): void => {
    void sharePlace({ id: point.id, canonicalLabel: point.meta.canonicalLabel }).catch(() => undefined);
  };

  const openCheckIn = useCallback((): void => {
    if (checkedIn || checkInSubmitting) return;
    dispatch(clearCheckInError());
    setCheckInOpen(true);
  }, [checkInSubmitting, checkedIn, dispatch]);

  const closeCheckIn = useCallback((): void => {
    if (checkInSubmitting) return;
    dispatch(clearCheckInError());
    setCheckInOpen(false);
  }, [checkInSubmitting, dispatch]);

  const submitCheckIn = useCallback(async (audience: CheckInAudience): Promise<void> => {
    if (checkedIn || checkInSubmitting) return;
    try {
      const coords = await getCurrentLocation({ requestPermission: true });
      if (coords == null) return;
      await dispatch(createPlacePulseCheckIn({
        placeId: point.id,
        audience,
        lat: coords.lat,
        lng: coords.lng,
      })).unwrap();
      setCheckedInPlaceId(point.id);
      setCheckInOpen(false);
    } catch {
      // Redux owns the user-visible API error state.
    }
  }, [checkInSubmitting, checkedIn, dispatch, getCurrentLocation, point.id]);

  const continueInDetails = useCallback((): void => {
    if (checkInSubmitting) return;
    dispatch(clearCheckInError());
    setCheckInOpen(false);
    onCheckIn();
  }, [checkInSubmitting, dispatch, onCheckIn]);

  return (
    <>
      <NexaPlaceSheet
        title={point.meta.canonicalLabel}
        subtitle="NEXA shows only a coarse map area for this place."
        meta={meta}
        primaryAction={{
          id: 'check-in',
          label: checkedIn ? 'Checked in' : 'Check in',
          icon: checkedIn ? 'check-circle' : 'map-marker-check-outline',
          onPress: openCheckIn,
          disabled: checkedIn || checkInSubmitting,
          loading: checkInSubmitting,
          accessibilityLabel: checkedIn
            ? `Checked in at ${point.meta.canonicalLabel}`
            : `Check in at ${point.meta.canonicalLabel}`,
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
        accessibilityLabel={`${point.meta.canonicalLabel}, place, approximate location${point.meta.trending ? ', recent anonymous local activity' : ''}${saved ? ', saved' : ''}${checkedIn ? ', checked in' : ''}`}
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

      <Modal
        visible={checkInOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCheckIn}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCheckIn}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalIcon}>
              <Icon name="map-marker-check-outline" size={26} color={colors.discovery} />
            </View>
            <Text style={styles.modalTitle}>Check in at {point.meta.canonicalLabel}</Text>
            <Text style={styles.modalBody}>
              Choose who can see this explicit check-in. NEXA uses your current location only after you choose an audience to verify that you're near this place; exact coordinates are not stored.
            </Text>

            {checkInError ? (
              <View style={styles.modalError} accessibilityRole="alert">
                <Icon name="alert-circle-outline" size={17} color={colors.danger} />
                <View style={styles.errorCopy}>
                  <Text style={styles.modalErrorText}>{checkInError}</Text>
                  <TouchableOpacity
                    onPress={continueInDetails}
                    disabled={checkInSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Continue check-in in place details"
                    style={styles.fallbackButton}
                  >
                    <Text style={styles.fallbackButtonText}>Continue in details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <AudienceButton
              label="Friends"
              description="Visible only to your friends."
              icon="account-group-outline"
              loading={checkInSubmitting}
              onPress={() => void submitCheckIn('friends')}
              colors={colors}
              styles={styles}
            />
            <AudienceButton
              label="Nearby"
              description="Visible in local Pulse; may contribute to anonymous place trends."
              icon="radar"
              loading={checkInSubmitting}
              onPress={() => void submitCheckIn('nearby')}
              colors={colors}
              styles={styles}
            />

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeCheckIn}
              disabled={checkInSubmitting}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function AudienceButton({
  label,
  description,
  icon,
  loading,
  onPress,
  colors,
  styles,
}: {
  label: string;
  description: string;
  icon: string;
  loading: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.audienceButton}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityState={{ busy: loading }}
    >
      <View style={styles.audienceIcon}>
        <Icon name={icon} size={21} color={colors.discovery} />
      </View>
      <View style={styles.audienceText}>
        <Text style={styles.audienceLabel}>{label}</Text>
        <Text style={styles.audienceDescription}>{description}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.discovery} />
      ) : (
        <Icon name="chevron-right" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    saveError: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.62)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    modalCard: {
      width: '100%',
      maxWidth: 460,
      borderRadius: 22,
      padding: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    modalIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoveryGhost,
    },
    modalTitle: {
      marginTop: 14,
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    modalBody: {
      marginTop: 7,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    modalError: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.dangerSurface,
    },
    errorCopy: { flex: 1 },
    modalErrorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
    fallbackButton: {
      minHeight: 44,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      marginTop: 4,
    },
    fallbackButtonText: { color: colors.discovery, fontSize: 13, fontWeight: '800' },
    audienceButton: {
      minHeight: 62,
      marginTop: 12,
      paddingHorizontal: 12,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceRaised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    audienceIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoveryGhost,
    },
    audienceText: { flex: 1 },
    audienceLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
    audienceDescription: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    cancelButton: {
      minHeight: 44,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  });
}
