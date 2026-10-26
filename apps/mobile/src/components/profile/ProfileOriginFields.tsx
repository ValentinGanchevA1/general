import React, {
  forwardRef,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { FormField } from '@/components/FormField';
import {
  clampBirthDate,
  getBirthDateBounds,
  parseIsoDate,
  searchCities,
  toIsoDate,
  type CitySuggestion,
} from '@/features/profile/profileOrigin';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

const PICKER_ROW_HEIGHT = 42;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

interface BirthDateFieldProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
}

interface NumberPickerColumnProps {
  accessibilityLabel: string;
  values: number[];
  selected: number;
  format: (value: number) => string;
  onSelect: (value: number) => void;
}

function NumberPickerColumn({
  accessibilityLabel,
  values,
  selected,
  format,
  onSelect,
}: NumberPickerColumnProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const initialIndex = Math.max(0, values.indexOf(selected));

  return (
    <FlatList
      style={styles.pickerColumn}
      data={values}
      keyExtractor={(item) => String(item)}
      showsVerticalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({
        length: PICKER_ROW_HEIGHT,
        offset: PICKER_ROW_HEIGHT * index,
        index,
      })}
      renderItem={({ item }) => {
        const active = item === selected;
        return (
          <TouchableOpacity
            style={[
              styles.pickerRow,
              active ? { backgroundColor: colors.actionSoft } : null,
            ]}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${accessibilityLabel} ${format(item)}`}
          >
            <Text
              style={[
                styles.pickerRowText,
                { color: active ? colors.actionPrimary : colors.textSecondary },
              ]}
            >
              {format(item)}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

export function BirthDateField({
  value,
  error,
  onChange,
  onComplete,
}: BirthDateFieldProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const bounds = useMemo(() => getBirthDateBounds(), []);
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(bounds.defaultDate);

  const years = useMemo(() => {
    const result: number[] = [];
    for (
      let year = bounds.maxDate.getFullYear();
      year >= bounds.minDate.getFullYear();
      year -= 1
    ) {
      result.push(year);
    }
    return result;
  }, [bounds]);

  const months = useMemo(() => {
    const minYear = bounds.minDate.getFullYear();
    const maxYear = bounds.maxDate.getFullYear();
    const selectedYear = draftDate.getFullYear();

    return Array.from({ length: 12 }, (_, index) => index).filter((month) => {
      if (selectedYear === minYear && month < bounds.minDate.getMonth()) return false;
      if (selectedYear === maxYear && month > bounds.maxDate.getMonth()) return false;
      return true;
    });
  }, [bounds, draftDate]);

  const days = useMemo(() => {
    const selectedYear = draftDate.getFullYear();
    const selectedMonth = draftDate.getMonth();
    const count = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    return Array.from({ length: count }, (_, index) => index + 1).filter((day) => {
      if (
        selectedYear === bounds.minDate.getFullYear() &&
        selectedMonth === bounds.minDate.getMonth() &&
        day < bounds.minDate.getDate()
      ) {
        return false;
      }
      if (
        selectedYear === bounds.maxDate.getFullYear() &&
        selectedMonth === bounds.maxDate.getMonth() &&
        day > bounds.maxDate.getDate()
      ) {
        return false;
      }
      return true;
    });
  }, [bounds, draftDate]);

  const openPicker = (): void => {
    const parsed = parseIsoDate(value);
    setDraftDate(clampBirthDate(parsed ?? bounds.defaultDate));
    setVisible(true);
  };

  const updateDraft = (year: number, month: number, day: number): void => {
    const maxDay = new Date(year, month + 1, 0).getDate();
    setDraftDate(clampBirthDate(new Date(year, month, Math.min(day, maxDay))));
  };

  const closeAndCommit = (): void => {
    onChange(toIsoDate(draftDate));
    setVisible(false);
    if (onComplete) {
      setTimeout(onComplete, 120);
    }
  };

  return (
    <>
      <View style={styles.fieldWrap}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date of birth</Text>
        <TouchableOpacity
          style={[
            styles.selectorControl,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: error ? colors.danger : colors.borderDefault,
            },
          ]}
          onPress={openPicker}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Choose date of birth"
          testID="onboarding-dob"
        >
          <Text
            style={[
              styles.selectorValue,
              { color: value ? colors.textPrimary : colors.textTertiary },
            ]}
          >
            {value || 'YYYY-MM-DD'}
          </Text>
          <Icon name="calendar-blank-outline" size={22} color={colors.discovery} />
        </TouchableOpacity>
        {error ? (
          <Text accessibilityRole="alert" style={[styles.fieldError, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.canvas, borderColor: colors.borderDefault }]}>
            <View style={styles.sheetHandleRow}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            </View>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: colors.discovery }]}>DATE OF BIRTH</Text>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Choose your birthday</Text>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
              >
                <Icon name="close" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetHint, { color: colors.textTertiary }]}>
              Your exact date stays private. NEXA stores it as {toIsoDate(draftDate)}.
            </Text>

            <View style={styles.pickerHeaderRow}>
              <Text style={[styles.pickerHeader, { color: colors.textTertiary }]}>YEAR</Text>
              <Text style={[styles.pickerHeader, { color: colors.textTertiary }]}>MONTH</Text>
              <Text style={[styles.pickerHeader, { color: colors.textTertiary }]}>DAY</Text>
            </View>
            <View style={[styles.pickerBox, { borderColor: colors.borderDefault, backgroundColor: colors.surfaceSecondary }]}>
              <NumberPickerColumn
                accessibilityLabel="Year"
                values={years}
                selected={draftDate.getFullYear()}
                format={(year) => String(year)}
                onSelect={(year) => updateDraft(year, draftDate.getMonth(), draftDate.getDate())}
              />
              <View style={[styles.pickerDivider, { backgroundColor: colors.borderSubtle }]} />
              <NumberPickerColumn
                accessibilityLabel="Month"
                values={months}
                selected={draftDate.getMonth()}
                format={(month) => MONTHS[month] ?? String(month + 1)}
                onSelect={(month) => updateDraft(draftDate.getFullYear(), month, draftDate.getDate())}
              />
              <View style={[styles.pickerDivider, { backgroundColor: colors.borderSubtle }]} />
              <NumberPickerColumn
                accessibilityLabel="Day"
                values={days}
                selected={draftDate.getDate()}
                format={(day) => String(day).padStart(2, '0')}
                onSelect={(day) => updateDraft(draftDate.getFullYear(), draftDate.getMonth(), day)}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.borderDefault }]}
                onPress={() => setVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.actionPrimary }]}
                onPress={closeAndCommit}
                activeOpacity={0.82}
                testID="onboarding-dob-done"
              >
                <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Done</Text>
                <Icon name="check" size={20} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface CityAutocompleteFieldProps {
  city: string;
  country: string;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
}

export const CityAutocompleteField = forwardRef<TextInput, CityAutocompleteFieldProps>(
  function CityAutocompleteField(
    { city, country, onCityChange, onCountryChange },
    ref,
  ): React.JSX.Element {
    const { colors } = useAppTheme();
    const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchFailed, setSearchFailed] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const query = city.trim();
    const shouldSearch = showSuggestions && query.length >= 2;

    useEffect(() => {
      if (!shouldSearch) return undefined;

      const controller = new AbortController();
      const timer = setTimeout(() => {
        setLoading(true);
        setSearchFailed(false);
        void searchCities(query, controller.signal)
          .then((items) => setSuggestions(items))
          .catch((error: unknown) => {
            if (error instanceof Error && error.name === 'AbortError') return;
            setSuggestions([]);
            setSearchFailed(true);
          })
          .finally(() => setLoading(false));
      }, 350);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }, [query, shouldSearch]);

    const handleCityChange = (value: string): void => {
      onCityChange(value);
      onCountryChange('');
      setShowSuggestions(true);
      setSearchFailed(false);
    };

    const selectSuggestion = (suggestion: CitySuggestion): void => {
      onCityChange(suggestion.city);
      onCountryChange(suggestion.countryCode);
      setSuggestions([]);
      setShowSuggestions(false);
      Keyboard.dismiss();
    };

    return (
      <>
        <View style={styles.cityFieldWrap}>
          <FormField
            ref={ref}
            label="From"
            value={city}
            onChangeText={handleCityChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="e.g. Varna"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            returnKeyType="done"
            testID="onboarding-city"
            trailingAccessory={
              shouldSearch && loading ? (
                <ActivityIndicator size="small" color={colors.discovery} style={styles.inputAccessory} />
              ) : (
                <Icon name="map-marker-outline" size={22} color={colors.discovery} style={styles.inputAccessory} />
              )
            }
          />

          {shouldSearch && suggestions.length > 0 ? (
            <View
              style={[
                styles.suggestions,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault },
              ]}
              testID="onboarding-city-suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[
                    styles.suggestionRow,
                    index < suggestions.length - 1
                      ? { borderBottomColor: colors.borderSubtle, borderBottomWidth: StyleSheet.hairlineWidth }
                      : null,
                  ]}
                  onPress={() => selectSuggestion(suggestion)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${suggestion.label}`}
                >
                  <Icon name="map-marker" size={20} color={colors.discovery} />
                  <View style={styles.suggestionCopy}>
                    <Text style={[styles.suggestionTitle, { color: colors.textPrimary }]}>
                      {suggestion.city}
                    </Text>
                    <Text numberOfLines={1} style={[styles.suggestionSub, { color: colors.textTertiary }]}>
                      {suggestion.label}
                    </Text>
                  </View>
                  {suggestion.countryCode ? (
                    <Text style={[styles.countryBadge, { color: colors.textSecondary }]}>
                      {suggestion.countryCode}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {shouldSearch && searchFailed ? (
            <Text style={[styles.autocompleteHint, { color: colors.textTertiary }]}>
              Suggestions unavailable — you can enter the city and country manually.
            </Text>
          ) : null}
        </View>

        <FormField
          label="Country"
          value={country}
          onChangeText={(value) => onCountryChange(value.toUpperCase())}
          placeholder="Auto-filled, e.g. BG"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
          returnKeyType="done"
          testID="onboarding-country"
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: 2 },
  selectorControl: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorValue: { flex: 1, fontSize: fontSize.md },
  fieldError: { fontSize: fontSize.xs, marginTop: 2, marginLeft: 2 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: 28,
  },
  sheetHandleRow: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: { width: 42, height: 4, borderRadius: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  sheetTitle: { marginTop: 4, fontSize: 24, fontWeight: '800' },
  sheetHint: { marginTop: 8, fontSize: fontSize.sm, lineHeight: 19 },
  pickerHeaderRow: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: 6 },
  pickerHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  pickerBox: { height: 210, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  pickerColumn: { flex: 1 },
  pickerRow: { height: PICKER_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5, borderRadius: radius.sm },
  pickerRowText: { fontSize: fontSize.md, fontWeight: '700' },
  pickerDivider: { width: StyleSheet.hairlineWidth },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: spacing.lg },
  secondaryButton: { minHeight: 52, flex: 1, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: fontSize.md, fontWeight: '700' },
  doneButton: { minHeight: 52, flex: 1.4, borderRadius: radius.lg, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { fontSize: fontSize.md, fontWeight: '800' },
  cityFieldWrap: { position: 'relative' },
  inputAccessory: { marginRight: 14 },
  suggestions: { marginTop: 6, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  suggestionRow: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionTitle: { fontSize: fontSize.md, fontWeight: '700' },
  suggestionSub: { marginTop: 2, fontSize: fontSize.xs },
  countryBadge: { fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 0.7 },
  autocompleteHint: { marginTop: 5, marginLeft: 2, fontSize: fontSize.xs },
});