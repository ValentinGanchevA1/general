// apps/mobile/src/features/discovery/TrendingFilterBar.tsx
//
// P3.6 "filter map by topic": a compact trending strip overlaid on the map.
// Tapping a topic filters the map to that topic (handled by useDiscovery's
// `topic` arg); tapping the active topic — or its ✕ — clears the filter.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme';

interface Props {
  topics: string[];
  activeTopic: string | null;
  onSelect: (topic: string | null) => void;
  /** Absolute top offset — raised when PulseStrip is mounted above. */
  topOffset?: number;
}

export function TrendingFilterBar({
  topics, activeTopic, onSelect, topOffset = 52,
}: Props): React.JSX.Element | null {
  // Nothing to surface unless there are topics or a filter is currently applied.
  if (topics.length === 0 && !activeTopic) return null;

  // Keep the active topic visible even if it drops out of the latest top-10.
  const chips = activeTopic && !topics.includes(activeTopic)
    ? [activeTopic, ...topics]
    : topics;

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <View style={styles.labelRow}>
        <Icon name="fire" size={14} color={colors.warning} />
        <Text style={styles.label}>Trending nearby</Text>
        {activeTopic ? (
          <TouchableOpacity onPress={() => onSelect(null)} hitSlop={8} style={styles.clear}>
            <Text style={styles.clearText}>Clear filter</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {chips.map((t) => {
          const active = t === activeTopic;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(active ? null : t)}
              testID={`map-trending-${t}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
              {active ? <Icon name="close" size={13} color={colors.bg} style={styles.chipClose} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 6 },
  label: { color: colors.warning, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  clear: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  clearText: { color: colors.dangerMuted, fontSize: 11, fontWeight: '700' },
  scroll: { paddingHorizontal: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(18,18,31,0.95)', borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.bg },
  chipClose: { marginLeft: 6 },
});
