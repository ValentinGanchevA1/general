import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { NexaSavedPlaceSummary } from '@g88/shared';

import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { loadSavedPlaces } from '@/features/places/placeDetailSlice';
import { savedPlacesMapLayerStore } from '@/features/places/savedPlacesMapLayer.store';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SavedPlacesScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const collection = useAppSelector((state) => state.places.saved);
  const loading = collection.loadId != null;
  const initialLoading = loading && collection.items.length === 0;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadSavedPlaces({ reset: true }));
    }, [dispatch]),
  );

  const refresh = useCallback(() => {
    void dispatch(loadSavedPlaces({ reset: true }));
  }, [dispatch]);

  const loadMore = useCallback(() => {
    if (collection.loadId || collection.nextOffset == null) return;
    void dispatch(loadSavedPlaces({}));
  }, [collection.loadId, collection.nextOffset, dispatch]);

  const openPlace = useCallback((placeId: string) => {
    navigation.navigate('PlaceDetail', { placeId });
  }, [navigation]);

  const exploreMap = useCallback(() => {
    navigation.navigate('Main', { screen: 'Map' });
  }, [navigation]);

  const showSavedOnMap = useCallback(() => {
    savedPlacesMapLayerStore.setEnabled(true);
    navigation.navigate('Main', { screen: 'Map' });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: NexaSavedPlaceSummary }) => (
    <Pressable
      style={styles.row}
      onPress={() => openPlace(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.canonicalLabel}. ${item.trending ? 'Getting active nearby.' : 'Saved place.'}`}
    >
      <View style={styles.iconWrap}>
        <Icon name="map-marker-radius-outline" size={22} color={colors.discovery} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.canonicalLabel}</Text>
        <View style={styles.metaRow}>
          {item.trending ? <>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Getting active nearby</Text>
          </> : <>
            <Icon name="shield-map-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.metaText}>Saved place · approximate area</Text>
          </>}
        </View>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  ), [colors.discovery, colors.textMuted, colors.textTertiary, openPlace, styles]);

  const mapAction = collection.items.length > 0 ? (
    <Pressable
      style={({ pressed }) => [styles.mapAction, pressed ? styles.mapActionPressed : null]}
      onPress={showSavedOnMap}
      accessibilityRole="button"
      accessibilityLabel="Show saved places on map"
      hitSlop={8}
    >
      <Icon name="map-marker-multiple-outline" size={22} color={colors.discovery} />
    </Pressable>
  ) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Saved places" right={mapAction} />
      {initialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.discovery} />
        </View>
      ) : collection.items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            variant="plain"
            icon={collection.error ? 'map-marker-alert-outline' : 'bookmark-map-outline'}
            title={collection.error ? "Couldn't load saved places" : 'No saved places yet'}
            body={collection.error
              ? collection.error
              : 'Save places from NEXA Place Detail to keep a private local collection.'}
            actionLabel={collection.error ? 'Retry' : 'Explore map'}
            onAction={collection.error ? refresh : exploreMap}
          />
        </View>
      ) : (
        <FlatList
          data={collection.items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={loading && collection.receivedAt > 0}
              onRefresh={refresh}
              tintColor={colors.discovery}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={collection.error ? (
            <Pressable style={styles.errorBanner} onPress={refresh} accessibilityRole="button">
              <Icon name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>{collection.error}</Text>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
          ListFooterComponent={loading && collection.receivedAt > 0 ? (
            <ActivityIndicator style={styles.footerLoader} color={colors.discovery} />
          ) : <View style={styles.footerSpace} />}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    mapAction: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoveryMutedBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
    },
    mapActionPressed: { opacity: 0.72 },
    row: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: colors.surfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoveryMutedBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    metaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.discovery },
    activeText: { color: colors.discovery, fontSize: 12, fontWeight: '700' },
    metaText: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
    separator: { height: 10 },
    errorBanner: {
      minHeight: 48,
      marginBottom: spacing.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfacePrimary,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: { flex: 1, color: colors.textSecondary, fontSize: 12 },
    retryText: { color: colors.actionPrimary, fontSize: 12, fontWeight: '800' },
    footerLoader: { paddingVertical: spacing.xl },
    footerSpace: { height: spacing.xxl },
  });
}
