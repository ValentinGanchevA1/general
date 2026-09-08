// apps/mobile/src/components/map/CreateNearbySheet.tsx
//
// Themed action sheet for map long-press "Create nearby".
// Same visual family as StoryCreateSheet / ActionSheetList:
// dark surface, handle, MCI icons, radius.md, subtle borders.

import React, { useCallback, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

export type CreateNearbyAction =
  | 'listing_sell'
  | 'listing_buy'
  | 'event'
  | 'alert';

interface Option {
  key: CreateNearbyAction;
  icon: string;
  title: string;
  hint: string;
  accent?: string;
}

const OPTIONS: Option[] = [
  {
    key: 'listing_sell',
    icon: 'tag-outline',
    title: 'Sell an item',
    hint: 'List something for sale nearby',
  },
  {
    key: 'listing_buy',
    icon: 'cart-outline',
    title: 'Looking to buy',
    hint: 'Post what you\u2019re searching for',
  },
  {
    key: 'event',
    icon: 'calendar-star',
    title: 'Create event',
    hint: 'Meetup, hangout, or gathering',
  },
  {
    key: 'alert',
    icon: 'bullhorn-outline',
    title: 'Post alert',
    hint: 'Local notice or heads-up',
  },
];

export interface CreateNearbySheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: CreateNearbyAction) => void;
}

export function CreateNearbySheet({
  visible,
  onClose,
  onSelect,
}: CreateNearbySheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback(
    (key: CreateNearbyAction) => {
      onClose();
      requestAnimationFrame(() => onSelect(key));
    },
    [onClose, onSelect],
  );

  const bottomPad = useMemo(
    () => Math.max(insets.bottom, spacing.md) + spacing.sm,
    [insets.bottom],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable
          style={[S.sheet, { paddingBottom: bottomPad }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={S.handle} />
          <Text style={S.title}>Create nearby</Text>
          <Text style={S.subtitle}>What do you want to post at this location?</Text>

          <View style={S.list}>
            {OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={S.row}
                onPress={() => handleSelect(opt.key)}
                activeOpacity={0.85}
                testID={`create-nearby-${opt.key}`}
                accessibilityRole="button"
                accessibilityLabel={opt.title}
                accessibilityHint={opt.hint}
              >
                <View style={S.iconWrap}>
                  <MCI name={opt.icon} size={22} color={colors.primary} />
                </View>
                <View style={S.rowText}>
                  <Text style={S.rowTitle}>{opt.title}</Text>
                  <Text style={S.rowHint}>{opt.hint}</Text>
                </View>
                <MCI name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={S.cancel}
            onPress={onClose}
            activeOpacity={0.8}
            testID="create-nearby-cancel"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={S.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,212,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cancel: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
