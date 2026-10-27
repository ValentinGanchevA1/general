import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

export interface ProfileSearchOption {
  value: string;
  label: string;
  meta?: string;
  searchText?: string;
}

interface Props {
  visible: boolean;
  title: string;
  placeholder: string;
  options: readonly ProfileSearchOption[];
  selectedValue?: string | null;
  allowCustom?: boolean;
  customLabel?: (value: string) => string;
  onClose: () => void;
  onSelect: (option: ProfileSearchOption) => void;
}

export function ProfileSearchPicker({
  visible,
  title,
  placeholder,
  options,
  selectedValue,
  allowCustom = false,
  customLabel = (value) => `Use “${value}”`,
  onClose,
  onSelect,
}: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return options.slice(0, 40);
    return options
      .filter((option) => `${option.label} ${option.meta ?? ''} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(normalized))
      .slice(0, 40);
  }, [normalized, options]);

  const customOption: ProfileSearchOption | null = allowCustom && query.trim() && !filtered.some((option) => option.label.toLocaleLowerCase() === normalized)
    ? { value: query.trim(), label: customLabel(query.trim()) }
    : null;
  const listData: ProfileSearchOption[] = customOption ? [customOption, ...filtered] : filtered;

  const close = (): void => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Close ${title}`}>
            <Icon name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchWrap}>
          <Icon name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={listData}
          keyExtractor={(item, index) => `${item.value}:${index}`}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const selected = item.value === selectedValue;
            return (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  setQuery('');
                  onSelect(item);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label}</Text>
                  {item.meta ? <Text style={styles.optionMeta}>{item.meta}</Text> : null}
                </View>
                {selected ? <Icon name="check" size={20} color={colors.primary} /> : <Icon name="chevron-right" size={20} color={colors.textFaint} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No matches. Keep typing or use a custom value where available.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderStrong,
    },
    headerSpacer: { width: 24 },
    title: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
    searchWrap: {
      margin: spacing.lg,
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, paddingVertical: 10 },
    list: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
    option: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    optionTextWrap: { flex: 1 },
    optionLabel: { color: colors.textPrimary, fontSize: fontSize.md },
    optionLabelSelected: { color: colors.primary, fontWeight: '700' },
    optionMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
    empty: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, paddingVertical: spacing.lg },
  });
}
