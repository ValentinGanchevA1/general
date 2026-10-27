import React, { useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  visible: boolean;
  value: string;
  onClose: () => void;
  onChange: (isoDate: string) => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function maxAdultDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
}

function parseInitial(value: string): Date {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return maxAdultDate();
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function formatProfileDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`.trim();
}

export function ProfileDatePicker({ visible, value, onClose, onChange }: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = parseInitial(value);
  const [day, setDay] = useState(initial.getDate());
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());

  const maxDate = maxAdultDate();
  const years = useMemo(() => {
    const newest = maxDate.getFullYear();
    return Array.from({ length: 100 }, (_, index) => newest - index);
  }, [maxDate]);

  const dayCount = daysInMonth(year, month);
  const safeDay = Math.min(day, dayCount);
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  const selectYear = (nextYear: number): void => {
    setYear(nextYear);
    setDay((current) => Math.min(current, daysInMonth(nextYear, month)));
  };

  const selectMonth = (nextMonth: number): void => {
    setMonth(nextMonth);
    setDay((current) => Math.min(current, daysInMonth(year, nextMonth)));
  };

  const apply = (): void => {
    const candidate = new Date(year, month, safeDay);
    if (candidate.getTime() > maxDate.getTime()) {
      onChange(`${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`);
    } else {
      onChange(`${year}-${pad(month + 1)}-${pad(safeDay)}`);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close date picker">
            <Icon name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Date of birth</Text>
          <TouchableOpacity onPress={apply} hitSlop={10} accessibilityRole="button" accessibilityLabel="Apply date">
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Your exact birth date stays private. NEXA only exposes your age when you enable it.</Text>

        <View style={styles.pickers}>
          <PickerColumn
            label="Day"
            values={days.map((value) => ({ key: String(value), label: String(value), selected: value === safeDay, onPress: () => setDay(value) }))}
            styles={styles}
          />
          <PickerColumn
            label="Month"
            values={MONTHS.map((label, index) => ({ key: label, label, selected: index === month, onPress: () => selectMonth(index) }))}
            styles={styles}
          />
          <PickerColumn
            label="Year"
            values={years.map((value) => ({ key: String(value), label: String(value), selected: value === year, onPress: () => selectYear(value) }))}
            styles={styles}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface PickerColumnStyles {
  column: object;
  columnLabel: object;
  columnScroll: object;
  pickerItem: object;
  pickerItemSelected: object;
  pickerText: object;
  pickerTextSelected: object;
}

function PickerColumn({
  label,
  values,
  styles,
}: {
  label: string;
  values: ReadonlyArray<{ key: string; label: string; selected: boolean; onPress: () => void }>;
  styles: PickerColumnStyles;
}): React.JSX.Element {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView style={styles.columnScroll} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {values.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.pickerItem, item.selected && styles.pickerItemSelected]}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: item.selected }}
          >
            <Text style={[styles.pickerText, item.selected && styles.pickerTextSelected]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
    title: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
    done: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
    hint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    pickers: { flex: 1, flexDirection: 'row', gap: 10, padding: spacing.lg },
    column: { flex: 1 },
    columnLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    columnScroll: { flex: 1, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
    pickerItem: { minHeight: 44, alignItems: 'center', justifyContent: 'center', margin: 4, borderRadius: radius.sm },
    pickerItemSelected: { backgroundColor: colors.primaryMutedBg, borderWidth: 1, borderColor: colors.primary },
    pickerText: { color: colors.textPrimary, fontSize: fontSize.md },
    pickerTextSelected: { color: colors.primary, fontWeight: '800' },
  });
}
