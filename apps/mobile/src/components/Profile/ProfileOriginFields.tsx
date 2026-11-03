import React, { forwardRef, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  CITY_OPTIONS,
  countryName,
} from '@/features/profile/profileReferenceData';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

import { ProfileDatePicker, formatProfileDate } from './ProfileDatePicker';
import {
  ProfileSearchPicker,
  type ProfileSearchOption,
} from './ProfileSearchPicker';

interface BirthDateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  onComplete?: () => void;
  error?: string;
}

export function BirthDateField({
  value,
  onChange,
  onComplete,
  error,
}: BirthDateFieldProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, error ? styles.fieldErrorBorder : null]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `Date of birth ${formatProfileDate(value)}` : 'Select date of birth'
        }
        testID="onboarding-dob"
      >
        <View style={styles.fieldTextWrap}>
          <Text style={styles.fieldLabel}>Date of birth</Text>
          <Text style={[styles.fieldValue, !value && styles.placeholder]}>
            {value ? formatProfileDate(value) : 'Select date'}
          </Text>
          <Text style={styles.fieldHint}>Private exact date · 18+ required</Text>
        </View>
        <Icon name="calendar-outline" size={22} color={colors.actionPrimary} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <ProfileDatePicker
        visible={open}
        value={value}
        onClose={() => {
          setOpen(false);
          onComplete?.();
        }}
        onChange={(iso) => {
          onChange(iso);
          setOpen(false);
          onComplete?.();
        }}
      />
    </View>
  );
}

interface CityAutocompleteFieldProps {
  city: string;
  country: string;
  onCityChange: (city: string) => void;
  onCountryChange: (country: string) => void;
}

export const CityAutocompleteField = forwardRef<TextInput, CityAutocompleteFieldProps>(
  function CityAutocompleteField({ city, country, onCityChange, onCountryChange }, ref) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [pickerOpen, setPickerOpen] = useState(false);

    const cityOptions = useMemo<ProfileSearchOption[]>(
      () =>
        CITY_OPTIONS.map((option) => ({
          value: `${option.city}::${option.countryCode}`,
          label: option.city,
          meta: countryName(option.countryCode),
          searchText: option.countryCode,
        })),
      [],
    );

    const selectedValue = city && country ? `${city}::${country}` : city || null;

    const selectCity = (option: ProfileSearchOption): void => {
      const separator = option.value.lastIndexOf('::');
      if (separator > 0) {
        onCityChange(option.value.slice(0, separator));
        onCountryChange(option.value.slice(separator + 2));
      } else {
        onCityChange(option.value);
      }
      setPickerOpen(false);
    };

    const display =
      city && country ? `${city}, ${countryName(country) || country}` : city || '';

    return (
      <View>
        <TextInput
          ref={ref}
          value={display}
          editable={false}
          style={styles.hiddenInput}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TouchableOpacity
          style={styles.field}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={display ? `Hometown ${display}` : 'Choose hometown city'}
          testID="onboarding-city"
        >
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>Hometown</Text>
            <Text style={[styles.fieldValue, !display && styles.placeholder]}>
              {display || 'Choose city'}
            </Text>
            <Text style={styles.fieldHint}>Optional · you control visibility later</Text>
          </View>
          <Icon name="map-marker-outline" size={22} color={colors.actionPrimary} />
        </TouchableOpacity>
        <ProfileSearchPicker
          visible={pickerOpen}
          title="Hometown"
          placeholder="Search city"
          options={cityOptions}
          selectedValue={selectedValue}
          allowCustom
          customLabel={(value) => `Use “${value}”`}
          onClose={() => setPickerOpen(false)}
          onSelect={selectCity}
        />
      </View>
    );
  },
);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: {
      minHeight: 72,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      backgroundColor: colors.surfaceSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: spacing.sm,
    },
    fieldErrorBorder: {
      borderColor: colors.danger,
    },
    fieldTextWrap: { flex: 1 },
    fieldLabel: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      fontWeight: '700',
      marginBottom: 2,
    },
    fieldValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    placeholder: {
      color: colors.textTertiary,
      fontWeight: '500',
    },
    fieldHint: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
      marginTop: -4,
    },
    hiddenInput: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
  });
}
