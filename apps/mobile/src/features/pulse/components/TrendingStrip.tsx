// apps/mobile/src/features/pulse/components/TrendingStrip.tsx

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  topics: string[];
  onTapTopic: (topic: string) => void;
}

export function TrendingStrip(props: Props): React.JSX.Element | null {
  const { topics, onTapTopic } = props;
  if (topics.length === 0) return null;

  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{'\u{1F525}'} Trending nearby</Text>
      </View>
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
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingTop: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  topic: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1, borderColor: '#2a2a4a',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
  },
  topicText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
});
