import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { CheckInAudience } from '@g88/shared';

import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useUserLocation } from '@/features/location/useUserLocation';
import {
  clearPendingPlaceCheckIn,
  takePendingPlaceCheckIn,
} from '@/features/places/pendingPlaceCheckIn';
import { loadPlaceDetail, setPlaceSaved } from '@/features/places/placeDetailSlice';
import { savedPlaceMapFocusStore } from '@/features/places/savedPlaceMapFocus.store';
import { sharePlace } from '@/features/places/sharePlace';
import {
  clearCheckInError,
  createPlacePulseCheckIn,
} from '@/features/pulse/pulseSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppTheme, type ThemeColors } from '@/theme';

type R = RouteProp<RootStackParamList, 'PlaceDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PlaceDetailScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { getCurrentLocation } = useUserLocation();
  const { placeId } = route.params;
  const state = useAppSelector((root) => root.places.entries[placeId]);
  const { checkInSubmitting, checkInError } = useAppSelector((root) => root.pulse);
  const place = state?.detail ?? null;
  const loading = state == null || state.loadId != null || (state.detail == null && state.error == null);
  const saving = state?.saveId != null;
  const error = state?.error ?? null;
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const consumedMapIntentRef = useRef(false);

  useEffect(() => {
    void dispatch(loadPlaceDetail({ placeId }));
  }, [dispatch, placeId]);

  useEffect(() => {
    if (place == null || consumedMapIntentRef.current) return undefined;
    if (!takePendingPlaceCheckIn(placeId)) return undefined;
    consumedMapIntentRef.current = true;
    dispatch(clearCheckInError());
    const frame = requestAnimationFrame(() => setCheckInOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [dispatch, place, placeId]);

  useEffect(() => () => clearPendingPlaceCheckIn(), []);

  const retry = useCallback(() => {
    void dispatch(loadPlaceDetail({ placeId, force: true }));
  }, [dispatch, placeId]);

  const toggleSaved = useCallback(() => {
    if (!place || saving) return;
    void dispatch(setPlaceSaved({ placeId, saved: !place.saved }));
  }, [dispatch, place, placeId, saving]);

  const shareCurrentPlace = useCallback(() => {
    if (!place) return;
    void sharePlace({ id: place.id, canonicalLabel: place.canonicalLabel }).catch(() => undefined);
  }, [place]);

  const openMap = useCallback(() => {
    if (!place) return;
    savedPlaceMapFocusStore.requestDetail(place);
    navigation.navigate('Main', { screen: 'Map' });
  }, [navigation, place]);

  const openCheckIn = useCallback(() => {
    if (checkedIn || checkInSubmitting) return;
    dispatch(clearCheckInError());
    setCheckInOpen(true);
  }, [checkedIn, checkInSubmitting, dispatch]);

  const closeCheckIn = useCallback(() => {
    if (checkInSubmitting) return;
    dispatch(clearCheckInError());
    setCheckInOpen(false);
  }, [checkInSubmitting, dispatch]);

  const submitCheckIn = useCallback(async (audience: CheckInAudience): Promise<void> => {
    if (!place || checkInSubmitting) return;
    try {
      const coords = await getCurrentLocation({ requestPermission: true });
      if (!coords) return;
      await dispatch(createPlacePulseCheckIn({
        placeId: place.id,
        audience,
        lat: coords.lat,
        lng: coords.lng,
      })).unwrap();
      setCheckedIn(true);
      setCheckInOpen(false);
    } catch {
      // Redux owns the user-visible API error state.
    }
  }, [checkInSubmitting, dispatch, getCurrentLocation, place]);

  if (!place) {
    return <View style={styles.container}>
      <ScreenHeader title="Place" />
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={colors.primary} /> : error ?
          <EmptyState
            variant="plain"
            icon="map-marker-alert-outline"
            title="Couldn't load place"
            body={error}
            actionLabel="Retry"
            onAction={retry}
          /> :
          <EmptyState
            variant="plain"
            icon="map-marker-off-outline"
            title="Place not found"
            body="This place may have been merged or is no longer available."
          />}
      </View>
    </View>;
  }

  return <View style={styles.container}>
    <ScreenHeader
      title="Place"
      right={
        <TouchableOpacity
          onPress={shareCurrentPlace}
          style={styles.headerAction}
          accessibilityRole="button"
          accessibilityLabel={`Share ${place.canonicalLabel}`}
        >
          <Icon name="share-variant-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      }
    />
    <View style={styles.content}>
      <View style={styles.heroIcon}>
        <Icon name="map-marker-radius" size={34} color={colors.discovery} />
      </View>
      <Text style={styles.title}>{place.canonicalLabel}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, place.trending && styles.statusPillActive]}>
          <View style={[styles.statusDot, place.trending && styles.statusDotActive]} />
          <Text style={[styles.statusText, place.trending && styles.statusTextActive]}>
            {place.trending ? 'Getting active nearby' : 'Local place'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Icon name="shield-map-outline" size={22} color={colors.textSecondary} />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Approximate map location</Text>
          <Text style={styles.cardBody}>
            NEXA focuses the coarse local area for this place. Exact venue coordinates are not stored in the place catalog.
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.inlineError} accessibilityRole="alert">
          <Icon name="alert-circle-outline" size={17} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.checkInButton, checkedIn && styles.checkInButtonDone]}
        onPress={openCheckIn}
        disabled={checkedIn || checkInSubmitting}
        accessibilityRole="button"
        accessibilityLabel={checkedIn ? `Checked in at ${place.canonicalLabel}` : `Check in at ${place.canonicalLabel}`}
        accessibilityState={{ disabled: checkedIn || checkInSubmitting }}
      >
        <Icon
          name={checkedIn ? 'check-circle' : 'map-marker-check-outline'}
          size={21}
          color={colors.onPrimary}
        />
        <Text style={styles.checkInButtonText}>{checkedIn ? 'Checked in' : 'Check in here'}</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, place.saved && styles.secondaryButtonActive]}
          onPress={toggleSaved}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={place.saved ? `Remove ${place.canonicalLabel} from saved places` : `Save ${place.canonicalLabel}`}
          accessibilityState={{ busy: saving, selected: place.saved }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.discovery} />
          ) : (
            <Icon
              name={place.saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={colors.discovery}
            />
          )}
          <Text style={styles.secondaryButtonText}>{place.saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openMap}
          accessibilityRole="button"
          accessibilityLabel={`View ${place.canonicalLabel} on map`}
        >
          <Icon name="map-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.primaryButtonText}>View on map</Text>
        </TouchableOpacity>
      </View>
    </View>

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
          <Text style={styles.modalTitle}>Check in at {place.canonicalLabel}</Text>
          <Text style={styles.modalBody}>
            Choose who can see this explicit check-in. NEXA uses your current location only to verify that you're near this place; exact coordinates are not stored.
          </Text>

          {checkInError ? (
            <View style={styles.modalError} accessibilityRole="alert">
              <Icon name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.modalErrorText}>{checkInError}</Text>
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
  </View>;
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
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    headerAction: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { paddingHorizontal: 20, paddingTop: 24 },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoveryGhost,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discovery,
    },
    title: { marginTop: 16, color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
    statusRow: { flexDirection: 'row', marginTop: 12 },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceRaised,
    },
    statusPillActive: { backgroundColor: colors.discoveryGhost },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textTertiary },
    statusDotActive: { backgroundColor: colors.discovery },
    statusText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    statusTextActive: { color: colors.discovery },
    card: {
      marginTop: 24,
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    cardText: { flex: 1 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    cardBody: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    inlineError: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.dangerSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.dangerBorder,
    },
    inlineErrorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },
    checkInButton: {
      marginTop: 20,
      minHeight: 52,
      borderRadius: 15,
      backgroundColor: colors.actionPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    checkInButtonDone: { opacity: 0.72 },
    checkInButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    secondaryButton: {
      minHeight: 50,
      minWidth: 112,
      paddingHorizontal: 16,
      borderRadius: 15,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.discovery,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButtonActive: { backgroundColor: colors.discoveryGhost },
    secondaryButtonText: { color: colors.discovery, fontSize: 15, fontWeight: '800' },
    primaryButton: {
      minHeight: 50,
      flex: 1,
      borderRadius: 15,
      backgroundColor: colors.actionPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
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
    modalTitle: { marginTop: 14, color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    modalBody: { marginTop: 7, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    modalError: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.dangerSurface,
    },
    modalErrorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },
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
    audienceDescription: { marginTop: 2, color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
    cancelButton: { minHeight: 44, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
    cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  });
}
