// apps/mobile/src/features/nudges/NudgeBanner.tsx
//
// Compact, dismissible map banner for the P3.1 leftover nudges (verification /
// streak). Mirrors DailyChallengeCard's styling and sits just below it; shows at
// most one nudge and self-hides when there's nothing to surface. Tapping opens
// the relevant screen; the close button suppresses it for the nudge's cooldown.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { track } from '@/lib/analytics';
import { useNudges } from './useNudges';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NudgeBanner(): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { nudge, dismiss } = useNudges();

  if (!nudge) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.main}
          onPress={() => {
            track('nudge.tap', { id: nudge.id });
            navigation.navigate(nudge.target);
          }}
        >
          <Icon name={nudge.icon} size={20} color={nudge.accent} />
          <View style={styles.body}>
            <Text style={[styles.label, { color: nudge.accent }]}>{nudge.label}</Text>
            <Text style={styles.title} numberOfLines={2}>{nudge.title}</Text>
          </View>
          <View style={[styles.ctaPill, { backgroundColor: nudge.accent + '20' }]}>
            <Text style={[styles.ctaText, { color: nudge.accent }]}>{nudge.cta}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={10}
          style={styles.close}
          onPress={() => {
            track('nudge.dismiss', { id: nudge.id });
            dismiss(nudge.id);
          }}
        >
          <Icon name="close" size={16} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Stacks directly under DailyChallengeCard (top: 116, ~44px tall).
    top: 168,
    left: 16,
    right: 16,
    alignItems: 'center',
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
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  ctaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ctaText: { fontSize: 12, fontWeight: '700' },
  close: { padding: 8, marginLeft: 2 },
});
