// apps/mobile/src/components/map/CreateNearbySheet.tsx
//
// Map long-press create picker — same visual family as ActionSheetList /
// StoryCreateSheet (dark surface, cyan accents, MCI icons).

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius, fontSize } from '@/theme';

export type CreateNearbyKind = 'listing' | 'event' | 'alert';

interface Option {
  kind: CreateNearbyKind;
  label: string;
  hint: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

const OPTIONS: Option[] = [
  {
    kind: 'listing',
    label: 'List item',
    hint: 'Sell or trade something nearby',
    icon: 'tag-outline',
    iconColor: colors.action,
    iconBg: 'rgba(52, 224, 161, 0.14)',
  },
  {
    kind: 'event',
    label: 'Create event',
    hint: 'Plan a meetup at this spot',
    icon: 'calendar-star',
    iconColor: colors.accent,
    iconBg: 'rgba(124, 92, 255, 0.16)',
  },
  {
    kind: 'alert',
    label: 'Post alert',
    hint: 'Share something happening now',
    icon: 'bullhorn-outline',
    iconColor: colors.warning,
    iconBg: 'rgba(255, 157, 60, 0.14)',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: CreateNearbyKind) => void;
}

export function CreateNearbySheet({ visible, onClose, onSelect }: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss">
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Create nearby</Text>
          <Text style={styles.subtitle}>What do you want to post at this spot?</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.kind}
                testID={`create-nearby-${opt.kind}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onSelect(opt.kind)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <View style={[styles.iconWrap, { backgroundColor: opt.iconBg }]}>
                  <MCI name={opt.icon} size={22} color={opt.iconColor} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  <Text style={styles.rowHint}>{opt.hint}</Text>
                </View>
                <MCI name="chevron-right" size={20} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.rowPressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 8,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  rowHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  cancelBtn: {
    marginTop: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
