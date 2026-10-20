// Compact, dismissible supporting banner for the next incomplete daily challenge.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { useChallenges } from './useChallenges';
import { useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const CHALLENGE_CARD_HEIGHT = 52;

interface Props {
  top: number;
  onDismiss?: () => void;
}

export function DailyChallengeCard({ top, onDismiss }: Props): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { colors, shadow } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { challenges } = useChallenges();
  const [localDismissed, setLocalDismissed] = useState(false);

  const dismissed = onDismiss != null ? false : localDismissed;
  if (dismissed) return null;
  const next = challenges.find((challenge) => !challenge.completed);
  if (!next) return null;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={[styles.card, shadow(0.1)]}>
        <TouchableOpacity activeOpacity={0.82} style={styles.main} onPress={() => openRootScreen(navigation, 'Challenges')} accessibilityRole="button" accessibilityLabel={`Today's challenge: ${next.title}, ${next.progress} of ${next.target}`}>
          <View style={styles.iconWrap}><Icon name="target" size={17} color={colors.primary} /></View>
          <View style={styles.body}>
            <Text style={styles.label}>Today's challenge</Text>
            <Text style={styles.title} numberOfLines={1}>{next.title}</Text>
          </View>
          <View style={styles.progressPill}><Text style={styles.progressText}>{next.progress}/{next.target}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Dismiss today's challenge" onPress={() => { if (onDismiss) onDismiss(); else setLocalDismissed(true); }}>
          <Icon name="close" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 21 },
    card: { minHeight: CHALLENGE_CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', width: '100%', paddingLeft: 8, paddingRight: 5, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle },
    main: { minHeight: CHALLENGE_CARD_HEIGHT, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primaryBorderSoft },
    body: { flex: 1, minWidth: 0 },
    label: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
    title: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 1 },
    progressPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.primaryGhost },
    progressText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
    close: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  });
}
