// apps/mobile/src/features/pulse/components/TrendingStrip.tsx
//
// Collapsible topic chips (Map TrendingCard density parity).

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  topics: string[];
  onTapTopic: (topic: string) => void;
  /** When true, only the section header is shown. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TrendingStrip(props: Props): React.JSX.Element | null {
  const { topics, onTapTopic, collapsed = false, onToggleCollapse } = props;
  if (topics.length === 0) return null;

  const header = (
    <View style={S.sectionHeader}>
      <Text style={S.sectionTitle}>{'🔥'} Trending nearby</Text>
      <Text style={S.sectionCount}>{topics.length}</Text>
      {onToggleCollapse ? (
        <Text style={S.expandHint}>{collapsed ? 'Show' : 'Hide'}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={S.section}>
      {onToggleCollapse ? (
        <TouchableOpacity
          onPress={onToggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed
              ? `Show trending topics, ${topics.length}`
              : `Hide trending topics`
          }
          testID="pulse-trending-toggle"
        >
          {header}
        </TouchableOpacity>
      ) : (
        header
      )}
      {!collapsed ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.scroll}
        >
          {topics.map((t) => (
            <TouchableOpacity
              key={t}
              style={S.topic}
              onPress={() => onTapTopic(t)}
              testID={`trending-topic-${t}`}
            >
              <Text style={S.topicText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingTop: 4, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 8,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  sectionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  expandHint: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  topic: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  topicText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
