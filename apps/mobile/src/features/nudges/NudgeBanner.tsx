// Compact, dismissible supporting banner for verification / streak nudges.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { openTrustCenter } from '@/navigation/openTrust';
import { track } from '@/lib/analytics';
import { useNudges } from './useNudges';
import { useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props { top: number; }

export function NudgeBanner({ top }: Props): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { colors, shadow } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { nudge, dismiss } = useNudges();

  if (!nudge) return null;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={[styles.card, shadow(0.1)]}>
        <TouchableOpacity
          activeOpacity={0.82}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={`${nudge.label}. ${nudge.title}. ${nudge.cta}`}
          onPress={() => {
            track('nudge.tap', { id: nudge.id });
            if (nudge.target === 'TrustCenter') {
              if (nudge.focusStep != null) openTrustCenter(navigation, nudge.focusStep);
              else openTrustCenter(navigation);
            } else {
              openRootScreen(navigation, nudge.target);
            }
          }}
        >
          <View style={[styles.iconWrap, { backgroundColor: nudge.accent + '14', borderColor: nudge.accent + '38' }]}>
            <Icon name={nudge.icon} size={17} color={nudge.accent} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.label, { color: nudge.accent }]}>{nudge.label}</Text>
            <Text style={styles.title} numberOfLines={1}>{nudge.title}</Text>
          </View>
          <View style={[styles.ctaPill, { backgroundColor: nudge.accent + '18' }]}>
            <Text style={[styles.ctaText, { color: nudge.accent }]}>{nudge.cta}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${nudge.label}`}
          onPress={() => { track('nudge.dismiss', { id: nudge.id }); dismiss(nudge.id); }}
        >
          <Icon name="close" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 20 },
    card: { minHeight: 52, flexDirection: 'row', alignItems: 'center', width: '100%', paddingLeft: 8, paddingRight: 5, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle },
    main: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    iconWrap: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0 },
    label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
    title: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 1 },
    ctaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    ctaText: { fontSize: 11, fontWeight: '800' },
    close: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  });
}
