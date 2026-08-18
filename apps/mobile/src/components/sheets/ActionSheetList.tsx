import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, fontSize } from '@/theme';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface Props {
  title?: string;
  items: ActionSheetItem[];
}

/** Vertical list of sheet actions (report / block / unfriend / …). */
export function ActionSheetList({ title, items }: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
            item.disabled && styles.rowDisabled,
          ]}
          onPress={item.onPress}
          disabled={item.disabled}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          {item.icon ? (
            <Icon
              name={item.icon}
              size={20}
              color={item.destructive ? colors.danger : colors.textPrimary}
              style={styles.icon}
            />
          ) : null}
          <Text
            style={[
              styles.label,
              item.destructive && styles.labelDestructive,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: 4,
  },
  title: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  icon: {
    marginRight: 12,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  labelDestructive: {
    color: colors.danger,
  },
});
