import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import type { PersonalLabel, PersonalLabelsFeaturePolicy, SelectedPersonalLabelsResponse } from '@g88/shared';
import { getJson } from '@/api/client';
import { Config } from '@/config';
import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  userId: string;
  own?: boolean;
}

/** Read-only, fail-closed personality chips for the existing profile surfaces. */
export function PersonalLabelsBadges({ userId, own = false }: Props): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<PersonalLabel[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setItems([]);
    if (!Config.PERSONAL_LABELS_REQUESTED || !userId) return () => { active = false; };
    const load = async (): Promise<void> => {
      try {
        const policy = await getJson<PersonalLabelsFeaturePolicy>('/runtime-config/personal-labels');
        if (!policy.enabled || !active) return;
        const path = own ? '/personal-labels/me?locale=en' : `/personal-labels/users/${userId}?locale=en`;
        const response = await getJson<SelectedPersonalLabelsResponse>(path);
        if (active) setItems(response.items);
      } catch {
        // Opt-in enhancement: do not leak API errors or stale private labels in profile.
        if (active) setItems([]);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId, own]));

  if (!Config.PERSONAL_LABELS_REQUESTED || items.length === 0) return null;

  return (
    <View style={styles.root} testID="personal-labels-profile">
      <Text style={styles.title}>{own ? "MY PERSONALITY" : "PERSONALITY"}</Text>
      <View style={styles.chips}>
        {items.map(item => (
          <View key={item.key} style={styles.chip}>
            <Text style={styles.chipText}>{item.emoji ? `${item.emoji} ` : ''}{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      marginHorizontal: spacing.xl, marginTop: spacing.md,
      padding: spacing.md, backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong,
      gap: spacing.sm,
    },
    title: { color: colors.primary, fontWeight: '800', fontSize: 12, letterSpacing: 0.7 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 10, paddingVertical: 7 },
    chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  });
}
