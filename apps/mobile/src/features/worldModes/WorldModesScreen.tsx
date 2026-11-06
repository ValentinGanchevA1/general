import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { AccountStackParamList } from '@/navigation/stacks';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { worldModePalettes } from '@/theme/worldModePalettes';

import {
  WORLD_MODES,
  WORLD_MODES_ENABLED,
  WORLD_MODE_IDS,
  type WorldModeCategory,
  type WorldModeId,
} from './worldModes';
import { activateWorldMode, clearWorldModeError, hydrateWorldMode } from './worldModesSlice';

type CategoryFilter = WorldModeCategory | 'all';

const FILTERS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Social' },
  { id: 'explore', label: 'Explore' },
  { id: 'create', label: 'Create' },
  { id: 'lifestyle', label: 'Lifestyle' },
];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    eyebrow: { color: colors.textSecondary, fontSize: fontSize.xs, letterSpacing: 1.6, fontWeight: '800' },
    heroTitle: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm },
    intro: { color: colors.textSecondary, marginTop: spacing.sm, fontSize: fontSize.md, lineHeight: 22 },
    filters: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.lg },
    filter: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surfacePrimary },
    filterActive: { backgroundColor: colors.surfaceTertiary, borderColor: colors.primary },
    filterLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: fontSize.sm },
    filterLabelActive: { color: colors.textPrimary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
    card: { width: '48%', minHeight: 166, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
    cardSymbol: { fontSize: 28, fontWeight: '700', marginBottom: spacing.sm },
    cardName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    cardSubtitle: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 5, lineHeight: 17 },
    tag: { color: colors.textFaint, fontSize: 10, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.7, marginTop: spacing.md },
    preview: { marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg },
    previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    previewTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '800', marginTop: spacing.sm },
    previewBody: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
    bullet: { color: colors.textPrimary, fontSize: fontSize.sm, marginTop: spacing.sm },
    activeLabel: { fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
    footer: { backgroundColor: colors.bg, borderTopColor: colors.borderSubtle, borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
    cta: { minHeight: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    ctaText: { color: colors.bg, fontSize: fontSize.md, fontWeight: '800' },
    error: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
    hint: { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, fontSize: fontSize.xs },
  });
}

export function WorldModesScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { selectedId, hydrated, saving, error } = useAppSelector((state) => state.worldModes);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [previewId, setPreviewId] = useState<WorldModeId>('nexus');

  useEffect(() => {
    if (userId && WORLD_MODES_ENABLED) void dispatch(hydrateWorldMode(userId));
  }, [dispatch, userId]);

  useEffect(() => {
    if (hydrated) setPreviewId(selectedId);
  }, [hydrated, selectedId]);

  const visibleIds = useMemo(
    () => WORLD_MODE_IDS.filter((id) => filter === 'all' || WORLD_MODES[id].category === filter),
    [filter],
  );
  const preview = WORLD_MODES[previewId];
  const accent = worldModePalettes[previewId];
  const isActive = selectedId === previewId;

  const activate = async (): Promise<void> => {
    if (!userId || saving || !hydrated || isActive) return;
    try {
      await dispatch(activateWorldMode({ userId, id: previewId })).unwrap();
      navigation.goBack();
    } catch {
      // Rejection is displayed through the Redux error state below.
    }
  };

  if (!WORLD_MODES_ENABLED) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="World Modes" />
        <View style={styles.content}>
          <Text style={styles.intro}>World Modes are not available in this release.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="World Modes" bordered />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.eyebrow, { marginTop: spacing.xl }]}>NEXA / WORLD EXPERIENCES</Text>
        <Text style={styles.heroTitle}>Choose your world.</Text>
        <Text style={styles.intro}>Same people. Same places. A new perspective. Preview freely; activate without changing your privacy or access.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, filter === item.id ? styles.filterActive : undefined]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              accessibilityLabel={'Filter World Modes: ' + item.label}
              testID={'world-filter-' + item.id}
            >
              <Text style={[styles.filterLabel, filter === item.id ? styles.filterLabelActive : undefined]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.grid}>
          {visibleIds.map((id) => {
            const mode = WORLD_MODES[id];
            const palette = worldModePalettes[id];
            const selected = previewId === id;
            return (
              <TouchableOpacity
                key={id}
                testID={'world-mode-' + id}
                disabled={!hydrated || !userId}
                onPress={() => { dispatch(clearWorldModeError()); setPreviewId(id); }}
                style={[styles.card, selected ? { borderColor: palette.accent, backgroundColor: palette.glow } : undefined]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !hydrated || !userId }}
                accessibilityLabel={mode.label + ', ' + mode.subtitle + (selectedId === id ? ', currently active' : '')}
                accessibilityHint="Preview this World Mode. Does not change your preference."
              >
                <Text style={[styles.cardSymbol, { color: palette.accent }]}>{mode.symbol}</Text>
                <Text style={styles.cardName}>{mode.label}</Text>
                <Text style={styles.cardSubtitle}>{mode.subtitle}</Text>
                <Text style={styles.tag}>{selectedId === id ? 'ACTIVE WORLD' : mode.category}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.preview, { borderColor: accent.accent }]}>
          <View style={styles.previewTop}>
            <Text style={[styles.eyebrow, { color: accent.accent }]}>MODE PREVIEW</Text>
            {isActive ? <Text style={[styles.activeLabel, { color: accent.accent }]}>● ACTIVE</Text> : null}
          </View>
          <Text style={styles.previewTitle}>{preview.label}</Text>
          <Text style={styles.previewBody}>{preview.description}</Text>
          {preview.highlights.map((highlight) => (
            <Text key={highlight} style={styles.bullet}>✦  {highlight}</Text>
          ))}
        </View>
        <Text style={styles.hint}>This mode changes only your saved World Mode preference. Theme and Premium controls remain independent.</Text>
      </ScrollView>
      <View style={styles.footer}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          testID="world-mode-activate"
          onPress={() => { void activate(); }}
          disabled={saving || !hydrated || !userId || isActive}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !hydrated || !userId || isActive }}
          style={[styles.cta, { backgroundColor: accent.accent, opacity: saving || !hydrated || !userId || isActive ? 0.55 : 1 }]}
        >
          {saving ? <ActivityIndicator color={colors.bg} /> : (
            <Text style={styles.ctaText}>{!hydrated ? 'Loading…' : isActive ? 'Current World' : 'Activate ' + preview.label}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}