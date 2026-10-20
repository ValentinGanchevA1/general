import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  onEdit: () => void;
}

/** Single primary CTA — photos managed from gallery section; trust via TrustStrip. */
export function ProfileQuickActions({ onEdit }: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.actionsRow}>
      <TouchableOpacity style={styles.actionButton} onPress={onEdit} accessibilityRole="button">
        <Icon name="pencil" size={18} color={colors.textPrimary} />
        <Text style={styles.actionButtonText}>Edit profile</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.md,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: 12,
      borderRadius: radius.md,
    },
    actionButtonText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  });
}
