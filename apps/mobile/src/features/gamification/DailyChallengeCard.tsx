// apps/mobile/src/features/gamification/DailyChallengeCard.tsx
//
// Compact, dismissible banner that surfaces the user's next incomplete daily
// challenge on the map. Anchored at the absolute top (stories live on Pulse).
// Tapping opens Challenges; close hides for the session.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useChallenges } from './useChallenges';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Approx card height used by MapScreen / NudgeBanner for stacking. */
export const CHALLENGE_CARD_HEIGHT = 56;

interface Props {
  /** Absolute top offset — owned by MapChrome layout. */
  top: number;
}

export function DailyChallengeCard({ top }: Props): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { challenges } = useChallenges();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  const next = challenges.find((c) => !c.completed);
  if (!next) return null;

  return (
    <View
      style={[styles.wrap, { top }]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.main}
          onPress={() => navigation.navigate('Challenges')}
        >
          <Icon name="target" size={20} color="#00d4ff" />
          <View style={styles.body}>
            <Text style={styles.label}>Today's challenge</Text>
            <Text style={styles.title} numberOfLines={1}>{next.title}</Text>
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>{next.progress}/{next.target}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={10} style={styles.close} onPress={() => setDismissed(true)}>
          <Icon name="close" size={16} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 21,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(18,18,31,0.95)',
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1 },
  label: { color: '#00d4ff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  progressPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#00d4ff20',
  },
  progressText: { color: '#00d4ff', fontSize: 12, fontWeight: '700' },
  close: { padding: 8, marginLeft: 2 },
});
