// apps/mobile/src/features/discovery/TrendingFilterBar.tsx
//
// P3.6 "filter map by topic": a compact trending strip overlaid on the map.
// Tapping a topic filters the map to that topic (handled by useDiscovery's
// `topic` arg); tapping the active topic — or its ✕ — clears the filter.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  topics: string[];
  activeTopic: string | null;
  onSelect: (topic: string | null) => void;
}

export function TrendingFilterBar({
  topics, activeTopic, onSelect,
}: Props): React.JSX.Element | null {
  // Nothing to surface unless there are topics or a filter is currently applied.
  if (topics.length === 0 && !activeTopic) return null;

  // Keep the active topic visible even if it drops out of the latest top-10.
  const chips = activeTopic && !topics.includes(activeTopic)
    ? [activeTopic, ...topics]
    : topics;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.labelRow}>
        <Icon name="fire" size={14} color="#ff9d3c" />
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
              {active ? <Icon name="close" size={13} color="#0a0a0f" style={styles.chipClose} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Positioning is owned by MapTopStack; this is just the content row.
  wrap: { width: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 6 },
  label: { color: '#ff9d3c', fontSize: 12, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  clear: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  clearText: { color: '#ff6b6b', fontSize: 11, fontWeight: '700' },
  scroll: { paddingHorizontal: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(18,18,31,0.95)', borderWidth: 1, borderColor: '#1f1f33',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#00d4ff', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#0a0a0f' },
  chipClose: { marginLeft: 6 },
});
