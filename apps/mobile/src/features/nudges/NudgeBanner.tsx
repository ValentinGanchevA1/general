// apps/mobile/src/features/nudges/NudgeBanner.tsx
//
// Presentational P3.1 nudge banner (verification / streak). The nudge selection
// and dismissal state live in `useNudges`, which is owned by the parent
// (MapTopStack) so the map shows at most one promo at a time. This component is
// pure render: given a nudge, draw it; tapping opens the target screen, the ✕
// calls back to dismiss. Positioning is owned by the parent stack — no absolute
// offsets here.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { track } from '@/lib/analytics';
import type { Nudge } from './useNudges';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  nudge: Nudge;
  onDismiss: (id: string) => void;
}

export function NudgeBanner({ nudge, onDismiss }: Props): React.JSX.Element {
  const navigation = useNavigation<Nav>();

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
            onDismiss(nudge.id);
          }}
        >
          <Icon name="close" size={16} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, alignItems: 'center' },
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
