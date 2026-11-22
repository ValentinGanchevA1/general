import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';
import { worldModePalettes } from '@/theme/worldModePalettes';
import { activateWorldMode, clearWorldModeError } from '@/features/worldModes/worldModesSlice';
import { WORLD_MODES, WORLD_MODE_IDS, type WorldModeId } from '@/features/worldModes/worldModes';
import { resolveWorldMapContext } from '@/features/worldModes/worldMapContext';

export function MapWorldSelector(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { selectedId, ownerId, hydrated, saving, error } = useAppSelector((state) => state.worldModes);
  const [open, setOpen] = useState(false);
  const mapContext = resolveWorldMapContext(selectedId);
  const discoveryPreset = mapContext.discoveryPreset;
  const suggestedActions = mapContext.actions;

  const choose = async (id: WorldModeId): Promise<void> => {
    if (!userId || ownerId !== userId || !hydrated || saving || id === selectedId) return;
    try {
      await dispatch(activateWorldMode({ userId, id })).unwrap();
      setOpen(false);
    } catch {
      // Redux error state is surfaced in the modal.
    }
  };

  return (
    <>
      <Pressable
        testID="map-world-selector-open"
        onPress={() => { dispatch(clearWorldModeError()); setOpen(true); }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={'World context, ' + WORLD_MODES[selectedId].label}
        accessibilityHint="Choose a different World context"
      >
        <Text style={[styles.symbol, { color: worldModePalettes[selectedId].accent }]}>{WORLD_MODES[selectedId].symbol}</Text>
        <Text style={styles.triggerLabel}>World</Text>
        <Icon name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>World context</Text>
                <Text style={styles.subtitle}>Same map and people. Change your perspective.</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityRole="button" accessibilityLabel="Close World selector">
                <Icon name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View testID="map-world-context-preview" style={styles.contextPreview} accessibilityLabel={
              'Suggested map focus: ' + (discoveryPreset?.label ?? 'Shared NEXUS map') +
              (mapContext.spatialSuggestion ? ', suggested lens: ' + mapContext.spatialSuggestion.lens : '')
            }>
              <Text style={styles.contextEyebrow}>SUGGESTED MAP FOCUS</Text>
              <Text style={styles.contextLabel}>{discoveryPreset?.label ?? 'Shared NEXUS map'}</Text>
              {mapContext.spatialSuggestion ? (
                <Text style={styles.contextLens}>
                  Suggested lens: {mapContext.spatialSuggestion.lens === 'experiences' ? 'Experiences' : 'Opportunities'}
                </Text>
              ) : null}
              {discoveryPreset?.emphasis.length ? (
                <Text style={styles.contextEmphasis}>{discoveryPreset.emphasis.map(formatEmphasisLabel).join(' · ')}</Text>
              ) : null}
              {suggestedActions.length > 0 ? (
                <Text style={styles.contextActions}>
                  Suggested actions: {suggestedActions.map((action) => action.label).join(' · ')}
                </Text>
              ) : (
                <Text style={styles.contextActions}>Use the shared map controls for discovery</Text>
              )}
            </View>
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {WORLD_MODE_IDS.map((id) => {
                const world = WORLD_MODES[id];
                const palette = worldModePalettes[id];
                const active = selectedId === id;
                return (
                  <Pressable
                    key={id}
                    testID={'map-world-' + id}
                    onPress={() => { void choose(id); }}
                    disabled={!userId || ownerId !== userId || !hydrated || saving}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !userId || ownerId !== userId || !hydrated || saving }}
                    accessibilityLabel={world.label + ', ' + world.subtitle + (active ? ', active' : '')}
                    style={({ pressed }) => [styles.worldRow, active ? { borderColor: palette.accent, backgroundColor: palette.glow } : undefined, pressed && styles.pressed]}
                  >
                    <View style={[styles.iconBox, { borderColor: palette.accent }]}>
                      <Text style={[styles.worldSymbol, { color: palette.accent }]}>{world.symbol}</Text>
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.worldName}>{world.label}</Text>
                      <Text style={styles.worldSubtitle}>{world.subtitle}</Text>
                    </View>
                    {active ? <Icon name="check-circle" size={20} color={palette.accent} /> : <Icon name="chevron-right" size={18} color={colors.textTertiary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Text style={styles.disclaimer}>These are suggestions only. Your map layers, filters, ranking, privacy, permissions and discovery access do not change automatically.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatEmphasisLabel(value: string): string {
  return value.replace(/-/g, ' ');
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    trigger: { minWidth: 70, height: 44, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surfacePrimary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    triggerLabel: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '800' },
    symbol: { fontSize: 16, fontWeight: '800' },
    pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', padding: spacing.lg },
    sheet: { maxHeight: '88%', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.surfacePrimary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
    close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    contextPreview: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surfaceSecondary, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
    contextEyebrow: { color: colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    contextLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    contextLens: { color: colors.discovery, fontSize: fontSize.xs, fontWeight: '700' },
    contextEmphasis: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
    contextActions: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
    list: { gap: spacing.sm, paddingVertical: spacing.xs },
    worldRow: { minHeight: 68, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderDefault, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    worldSymbol: { fontSize: 23, fontWeight: '800' },
    copy: { flex: 1 },
    worldName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    worldSubtitle: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 3 },
    error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
    disclaimer: { color: colors.textTertiary, fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.md },
  });
}
