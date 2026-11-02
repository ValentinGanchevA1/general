// apps/mobile/src/features/pulse/components/TrendingStrip.tsx
//
// Collapsible topic chips (Map TrendingCard density parity).

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  topics: string[];
  onTapTopic: (topic: string) => void;
  /** When true, only the section header is shown. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TrendingStrip(props: Props): React.JSX.Element | null {
  const { topics, onTapTopic, collapsed = false, onToggleCollapse } = props;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (topics.length === 0) return null;

  const header = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{'🔥'} Trending nearby</Text>
      <Text style={styles.sectionCount}>{topics.length}</Text>
      {onToggleCollapse ? (
        <Text style={styles.expandHint}>{collapsed ? 'Show' : 'Hide'}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.section}>
      {onToggleCollapse ? (
        <TouchableOpacity
          onPress={onToggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed
              ? `Show trending topics, ${topics.length}`
              : 'Hide trending topics'
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
          contentContainerStyle={styles.scroll}
        >
          {topics.map((topic) => (
            <TouchableOpacity
              key={topic}
              style={styles.topic}
              onPress={() => onTapTopic(topic)}
              testID={`trending-topic-${topic}`}
              accessibilityRole="button"
              accessibilityLabel={`Trending topic ${topic}`}
            >
              <Text style={styles.topicText}>{topic}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { paddingTop: 4, paddingBottom: 4 },
    sectionHeader: {
      minHeight: 44,
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
      minHeight: 44,
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 14,
      borderRadius: 14,
    },
    topicText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  });
}
