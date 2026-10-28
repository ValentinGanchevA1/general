import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { loadPlaceDetail, setPlaceSaved } from '@/features/places/placeDetailSlice';
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
  const { placeId } = route.params;
  const state = useAppSelector((root) => root.places.entries[placeId]);
  const place = state?.detail ?? null;
  const loading = state == null || state.loadId != null || (state.detail == null && state.error == null);
  const saving = state?.saveId != null;
  const error = state?.error ?? null;

  useEffect(() => {
    void dispatch(loadPlaceDetail({ placeId }));
  }, [dispatch, placeId]);

  const retry = useCallback(() => {
    void dispatch(loadPlaceDetail({ placeId, force: true }));
  }, [dispatch, placeId]);

  const toggleSaved = useCallback(() => {
    if (!place || saving) return;
    void dispatch(setPlaceSaved({ placeId, saved: !place.saved }));
  }, [dispatch, place, placeId, saving]);

  const openMap = useCallback(() => {
    if (!place) return;
    navigation.navigate('Main', {
      screen: 'Map',
      params: {
        focusLat: place.approximateLocation.lat,
        focusLng: place.approximateLocation.lng,
      },
    });
  }, [navigation, place]);

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
    <ScreenHeader title="Place" />
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
  </View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
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
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
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
  });
}
