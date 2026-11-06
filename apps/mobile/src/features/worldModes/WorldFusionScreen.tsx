import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { nexaSpatialLensStore } from '@/features/map/nexaSpatialLens.store';
import { nexaMapFilterIntentStore } from '@/features/map/nexaMapFilterIntent.store';
import { navigationRef } from '@/navigation/navigationRef';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAppTheme, type ThemeColors } from '@/theme';
import { worldModePalettes } from '@/theme/worldModePalettes';

import {
  createWorldFusionPreference,
  resolveWorldFusionPreview,
} from './worldFusion';
import {
  clearWorldFusionError,
  hydrateWorldFusion,
  saveWorldFusion,
} from './worldFusionSlice';
import {
  WORLD_MODES,
  WORLD_MODES_ENABLED,
  WORLD_MODE_IDS,
  type WorldModeId,
} from './worldModes';
import { hydrateWorldMode } from './worldModesSlice';

const FUSION_ENABLED = WORLD_MODES_ENABLED; // DEV-only until separate rollout QA.

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, gap: 16, paddingBottom: 36 },
    eyebrow: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
    },
    heading: { color: colors.textPrimary, fontSize: 27, fontWeight: '800', lineHeight: 34 },
    body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
    card: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      gap: 9,
    },
    pairRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    worldCard: {
      flex: 1,
      minWidth: 0,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      padding: 12,
      gap: 7,
    },
    worldSymbol: { fontSize: 27, fontWeight: '800' },
    worldLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
    worldRole: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: {
      width: '47%',
      minHeight: 76,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionName: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    activeStatus: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    detail: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    previewLine: {
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 4,
      marginTop: 6,
    },
    footer: {
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 22,
      gap: 10,
    },
    primaryButton: {
      backgroundColor: colors.actionPrimary,
      borderRadius: 14,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      paddingHorizontal: 16,
    },
    primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 15 },
    secondaryButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    secondaryText: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
    error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
    hint: { fontSize: 12, color: colors.textTertiary, lineHeight: 18, textAlign: 'center' },
  });
}

export function WorldFusionScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const primary = useAppSelector((state) => state.worldModes);
  const fusion = useAppSelector((state) => state.worldFusion);
  const currentLens = useSyncExternalStore(
    nexaSpatialLensStore.subscribe,
    nexaSpatialLensStore.getSnapshot,
  );
  const mapIntent = useSyncExternalStore(
    nexaMapFilterIntentStore.subscribe,
    nexaMapFilterIntentStore.getSnapshot,
  );

  // Keep an unsaved preview locally, scoped to its owner. A different account
  // can never see a previous account's unconfirmed selection.
  const [draft, setDraft] = useState<{
    ownerId: string;
    discoveryWorld: WorldModeId | null;
  } | null>(null);
  const primaryReady = userId != null &&
    primary.ownerId === userId && primary.hydrated;
  const fusionReady = userId != null &&
    fusion.ownerId === userId && fusion.hydrated;
  const ready = FUSION_ENABLED && primaryReady && fusionReady;

  useEffect(() => {
    if (!FUSION_ENABLED || userId == null) return;
    void dispatch(hydrateWorldMode(userId));
    void dispatch(hydrateWorldFusion(userId));
  }, [dispatch, userId]);

  const candidate = fusionReady
    ? draft?.ownerId === userId ? draft.discoveryWorld : fusion.discoveryWorld
    : null;

  const appearanceWorld = primaryReady ? primary.selectedId : 'nexus';
  const preference = createWorldFusionPreference(appearanceWorld, candidate);
  const preview = resolveWorldFusionPreview(preference, {
    currentLens,
    // Manual filters are summarized by the existing MapScreen without
    // exposing location or search contents. Unknown = fail closed.
    hasExplicitMapFilters: !mapIntent.known || mapIntent.hasExplicitFilters,
  });
  const appearancePalette = preview.appearance;
  const secondary = preference.discoveryWorld;
  const discoveryPalette = secondary == null ? null : worldModePalettes[secondary];
  const activeSecondary = fusionReady
    ? createWorldFusionPreference(appearanceWorld, fusion.discoveryWorld).discoveryWorld
    : null;
  const unchanged = secondary === activeSecondary;
  const saving = fusion.saving;
  const canApply = ready && secondary !== null && !unchanged && !saving;
  const canRemove = ready && fusion.discoveryWorld !== null && !saving;
  const canOpenLens = ready && !saving && unchanged && secondary !== null &&
    preview.canOfferLensChange && navigationRef.isReady();

  const selectWorld = (id: WorldModeId): void => {
    if (!ready || saving) return;
    dispatch(clearWorldFusionError());
    if (userId != null) setDraft({ ownerId: userId, discoveryWorld: id });
  };

  const apply = async (): Promise<void> => {
    if (!canApply || userId == null || secondary == null) return;
    try {
      await dispatch(saveWorldFusion({ userId, discoveryWorld: secondary })).unwrap();
    } catch {
      // Redux state contains the error; the last confirmed Fusion remains active.
    }
  };

  const remove = async (): Promise<void> => {
    if (!canRemove || userId == null) return;
    try {
      await dispatch(saveWorldFusion({ userId, discoveryWorld: null })).unwrap();
      setDraft({ ownerId: userId, discoveryWorld: null });
    } catch {
      // Do not claim removal when local persistence failed.
    }
  };

  const openSuggestedLens = (): void => {
    // Recheck current auth, saved selection, manual filters, and current lens
    // synchronously when pressed; a preview alone never changes the map.
    if (!ready || fusion.saving || secondary === null ||
        secondary !== fusion.discoveryWorld || !navigationRef.isReady()) return;
    const freshIntent = nexaMapFilterIntentStore.getSnapshot();
    const next = resolveWorldFusionPreview(
      createWorldFusionPreference(primary.selectedId, fusion.discoveryWorld),
      {
        currentLens: nexaSpatialLensStore.getSnapshot(),
        hasExplicitMapFilters: !freshIntent.known || freshIntent.hasExplicitFilters,
      },
    );
    if (!next.canOfferLensChange || next.suggestedLens == null) return;
    const originalLens = nexaSpatialLensStore.getSnapshot();
    try {
      nexaSpatialLensStore.set(next.suggestedLens);
      // Navigate into the existing Main/Map instance; no new map renderer.
      navigationRef.navigate('Main', { screen: 'Map' });
    } catch {
      nexaSpatialLensStore.set(originalLens);
      // No forced map state change if the navigation could not complete.
    }
  };

  if (!FUSION_ENABLED) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="World Fusion" />
        <View style={styles.content}>
          <Text style={styles.body}>World Fusion is not available in this release.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="World Fusion" bordered />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="world-fusion-scroll"
      >
        <Text style={styles.eyebrow}>NEXA / WORLDS 2.0</Text>
        <Text style={styles.heading} accessibilityRole="header">Combine two worlds.</Text>
        <Text style={styles.body}>
          Keep your active World for appearance. Choose a second World to
          inspire discovery — without changing your map filters or privacy settings.
        </Text>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>YOUR FUSION</Text>
          <View style={styles.pairRow}>
            <View
              style={[styles.worldCard, { borderColor: appearancePalette.accent }]}
              testID="fusion-appearance-world"
            >
              <Text style={[styles.worldSymbol, { color: appearancePalette.accent }]}>
                {WORLD_MODES[appearanceWorld].symbol}
              </Text>
              <Text style={styles.worldLabel}>{WORLD_MODES[appearanceWorld].label}</Text>
              <Text style={styles.worldRole}>A · Appearance</Text>
            </View>
            <View
              style={[
                styles.worldCard,
                { borderColor: discoveryPalette?.accent ?? colors.borderDefault },
              ]}
              testID="fusion-discovery-world"
            >
              <Text style={[styles.worldSymbol, { color: discoveryPalette?.accent ?? colors.textSecondary }]}>
                {secondary == null ? '＋' : WORLD_MODES[secondary].symbol}
              </Text>
              <Text style={styles.worldLabel}>
                {secondary == null ? 'Choose World B' : WORLD_MODES[secondary].label}
              </Text>
              <Text style={styles.worldRole}>B · Discovery idea</Text>
            </View>
          </View>
          <Text style={styles.detail} testID="fusion-saved-state">
            {!fusionReady
              ? 'Loading your saved Fusion…'
              : activeSecondary == null
                ? 'No Fusion currently active'
                : `Saved: ${WORLD_MODES[appearanceWorld].label} + ${WORLD_MODES[activeSecondary].label}`}
          </Text>
        </View>
        <Text style={styles.sectionTitle} accessibilityRole="header">Choose your second World</Text>
        <View style={styles.options} testID="fusion-world-options">
          {WORLD_MODE_IDS.filter((id) => id !== appearanceWorld).map((id) => {
            const selected = secondary === id;
            const palette = worldModePalettes[id];
            return (
              <TouchableOpacity
                key={id}
                onPress={() => selectWorld(id)}
                disabled={!ready || saving}
                testID={`fusion-option-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !ready || saving }}
                accessibilityLabel={`Preview ${WORLD_MODES[id].label} as discovery World`}
                accessibilityHint="Previews only. Does not change settings until Apply Fusion."
                style={[
                  styles.option,
                  selected
                    ? { borderColor: palette.accent, backgroundColor: palette.glow }
                    : undefined,
                ]}
              >
                <Text style={[styles.worldSymbol, { color: palette.accent }]}>
                  {WORLD_MODES[id].symbol}
                </Text>
                <Text style={styles.optionName}>{WORLD_MODES[id].label}</Text>
                {selected ? <Icon name="check-circle" size={18} color={colors.textPrimary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.card} testID="fusion-preview">
          <View style={styles.labelRow}>
            <Icon name="layers-triple-outline" size={20} color={appearancePalette.accent} />
            <Text style={styles.sectionTitle}>Fusion preview</Text>
          </View>
          <View style={[styles.previewLine, { borderLeftColor: appearancePalette.accent }]}>
            <Text style={styles.activeStatus}>
              {WORLD_MODES[appearanceWorld].label} appearance
            </Text>
            <Text style={styles.detail}>Decorative World A accents. Current app theme and trust badges remain unchanged.</Text>
          </View>
          <View style={[
            styles.previewLine,
            { borderLeftColor: discoveryPalette?.accent ?? colors.borderDefault },
          ]}>
            <Text style={styles.activeStatus}>
              {secondary == null
                ? 'No discovery World selected'
                : `${WORLD_MODES[secondary].label} discovery inspiration`}
            </Text>
            <Text style={styles.detail} testID="fusion-lens-suggestion">
              {preview.suggestedLens == null
                ? 'No automated discovery lens is implemented for this World.'
                : `Suggested existing lens: ${preview.suggestedLens === 'experiences'
                  ? 'Experiences'
                  : 'Opportunities'}. The map will not switch automatically.`}
            </Text>
          </View>
          <Text style={styles.hint}>
            Preview only: no live map data, new permissions, automatic RSVP, or hidden profiling.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {ready && unchanged && secondary !== null && preview.suggestedLens !== null ? (
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              testID="fusion-open-lens"
              accessibilityRole="button"
              accessibilityLabel={`Open ${preview.suggestedLens === 'experiences'
                ? 'Experiences' : 'Opportunities'} on the existing map`}
              accessibilityHint="Explicitly switches the map lens. Does not change location permissions or saved filters."
              accessibilityState={{ disabled: !canOpenLens }}
              disabled={!canOpenLens}
              onPress={openSuggestedLens}
              style={[styles.secondaryButton, { opacity: canOpenLens ? 1 : 0.5 }]}
            >
              <Text style={styles.secondaryText}>
                {preview.suggestedLens === 'experiences'
                  ? 'Open Experiences lens'
                  : 'Open Opportunities lens'}
              </Text>
            </TouchableOpacity>
            {!mapIntent.known ? (
              <Text testID="fusion-lens-blocked" style={styles.hint}>
                Open the Map once to verify your manual filter settings before switching lenses.
              </Text>
            ) : mapIntent.hasExplicitFilters ? (
              <Text testID="fusion-lens-blocked" style={styles.hint}>
                Manual map filters are active. Review or clear them on Map before using this shortcut.
              </Text>
            ) : currentLens !== 'map' ? (
              <Text testID="fusion-lens-blocked" style={styles.hint}>
                Your selected map lens has priority. Return to Map first to use this shortcut.
              </Text>
            ) : null}
          </View>
        ) : null}
        {fusion.error != null ? (
          <Text accessibilityRole="alert" style={styles.error} testID="fusion-error">
            {fusion.error}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => { void apply(); }}
          disabled={!canApply}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canApply }}
          accessibilityHint="Stores your choice on this device for your account. Does not change the active map."
          style={[styles.primaryButton, { opacity: canApply ? 1 : 0.5 }]}
          testID="fusion-apply"
        >
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : (
            <>
              <Icon name="check-circle-outline" size={19} color={colors.onPrimary} />
              <Text style={styles.primaryText}>
                {!ready ? 'Loading Fusion…' : unchanged && secondary !== null ? 'Fusion saved' : 'Apply Fusion'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {fusion.discoveryWorld != null && fusionReady ? (
          <TouchableOpacity
            onPress={() => { void remove(); }}
            disabled={!canRemove}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canRemove }}
            accessibilityLabel="Remove saved World Fusion"
            style={[styles.secondaryButton, { opacity: canRemove ? 1 : 0.5 }]}
            testID="fusion-remove"
          >
            <Text style={styles.secondaryText}>Remove Fusion</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.hint}>
          Your identity, friends, location visibility and manual map filters stay unchanged.
        </Text>
      </View>
    </View>
  );
}
