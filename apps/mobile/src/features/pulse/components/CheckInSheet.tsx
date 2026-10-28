import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  CheckInAudience,
  LatLng,
  PlaceIdentity,
  PlaceSuggestion,
} from '@g88/shared';
import { radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { searchPlaces } from '../placeSearch';

export interface CheckInDraft {
  placeLabel: string;
  placeIdentity: PlaceIdentity | null;
  audience: CheckInAudience;
}

interface Props {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  location: LatLng | null;
  onClose: () => void;
  onSubmit: (draft: CheckInDraft) => void;
}

export function CheckInSheet({
  visible,
  submitting,
  error,
  location,
  onClose,
  onSubmit,
}: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [placeLabel, setPlaceLabel] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [audience, setAudience] = useState<CheckInAudience>('friends');

  const normalizedLabel = placeLabel.trim();
  const locationReady = location != null;
  const canSubmit = normalizedLabel.length >= 2 && locationReady && !submitting;
  const searchEligible = visible
    && normalizedLabel.length >= 2
    && selectedPlace?.canonicalLabel !== normalizedLabel;
  const visibleSuggestions = searchEligible ? suggestions : [];
  const showSearching = searchEligible && searching;

  useEffect(() => {
    if (!searchEligible) return undefined;

    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!active) return;
      setSearching(true);
      void searchPlaces(normalizedLabel, location, controller.signal)
        .then((items) => {
          if (active) setSuggestions(items);
        })
        .catch((searchError: unknown) => {
          if (
            active
            && !(searchError instanceof Error && searchError.name === 'AbortError')
          ) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [location, normalizedLabel, searchEligible]);

  const onChangePlace = (value: string): void => {
    setPlaceLabel(value);
    setSelectedPlace(null);
    setSuggestions([]);
    setSearching(false);
  };

  const choosePlace = (place: PlaceSuggestion): void => {
    setPlaceLabel(place.canonicalLabel);
    setSelectedPlace(place);
    setSuggestions([]);
    setSearching(false);
  };

  const close = (): void => {
    setSuggestions([]);
    setSearching(false);
    onClose();
  };

  const submit = (): void => {
    const placeIdentity: PlaceIdentity | null = selectedPlace
      ? {
          provider: selectedPlace.provider,
          providerPlaceId: selectedPlace.providerPlaceId,
          canonicalLabel: selectedPlace.canonicalLabel,
          providerCellH3R7: selectedPlace.providerCellH3R7,
        }
      : null;
    onSubmit({ placeLabel: normalizedLabel, placeIdentity, audience });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={submitting ? undefined : close}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Check in nearby</Text>
          <Text style={styles.subtitle}>
            Share a place you chose to visit. NEXA never creates check-ins automatically from GPS.
          </Text>

          <Text style={styles.label}>Place</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={placeLabel}
              onChangeText={onChangePlace}
              placeholder="Search a place"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              editable={!submitting}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.input}
              accessibilityLabel="Place name"
            />
            {showSearching ? (
              <ActivityIndicator size="small" color={colors.actionPrimary} style={styles.searchSpinner} />
            ) : null}
          </View>

          {visibleSuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {visibleSuggestions.map((place) => (
                <TouchableOpacity
                  key={`${place.provider}:${place.providerPlaceId}`}
                  style={styles.suggestion}
                  onPress={() => choosePlace(place)}
                  disabled={submitting}
                >
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{place.canonicalLabel}</Text>
                  {place.secondaryLabel ? (
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>{place.secondaryLabel}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {selectedPlace ? (
            <Text style={styles.canonicalNote}>Canonical place selected · eligible for local trends</Text>
          ) : normalizedLabel.length >= 2 ? (
            <Text style={styles.customNote}>Custom place · visible in your check-in, but not used for local trends</Text>
          ) : null}

          <Text style={styles.label}>Who can see this?</Text>
          <View style={styles.audienceRow}>
            <AudienceOption
              label="Friends"
              detail="Safer default"
              selected={audience === 'friends'}
              disabled={submitting}
              onPress={() => setAudience('friends')}
              colors={colors}
            />
            <AudienceOption
              label="Nearby"
              detail="People around you"
              selected={audience === 'nearby'}
              disabled={submitting}
              onPress={() => setAudience('nearby')}
              colors={colors}
            />
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              Your current coordinate is used only to derive a coarse nearby area. Exact user and venue coordinates are not stored; the check-in expires after 6 hours.
            </Text>
          </View>

          {!locationReady ? <Text style={styles.locationWarning}>Location permission is required to check in.</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            disabled={!canSubmit}
            onPress={submit}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Check in"
          >
            {submitting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.submitText}>Check in</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} disabled={submitting} onPress={close} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface AudienceOptionProps {
  label: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: ThemeColors;
}

function AudienceOption({ label, detail, selected, disabled, onPress, colors }: AudienceOptionProps): React.JSX.Element {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.audienceOption, selected && styles.audienceOptionSelected]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={[styles.audienceTitle, selected && styles.audienceTitleSelected]}>{label}</Text>
      <Text style={styles.audienceDetail}>{detail}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 16 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 7, marginTop: 4 },
    inputWrap: { position: 'relative' },
    input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, fontSize: 16, paddingHorizontal: 14, paddingRight: 42 },
    searchSpinner: { position: 'absolute', right: 13, top: 14 },
    suggestions: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: 6 },
    suggestion: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
    suggestionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    suggestionSecondary: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    canonicalNote: { color: colors.actionPrimary, fontSize: 11, marginTop: 6, marginBottom: 10 },
    customNote: { color: colors.textMuted, fontSize: 11, marginTop: 6, marginBottom: 10 },
    audienceRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    audienceOption: { flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
    audienceOptionSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.actionGhost },
    audienceTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    audienceTitleSelected: { color: colors.actionPrimary, fontWeight: '700' },
    audienceDetail: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    privacyNote: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, marginBottom: 10 },
    privacyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
    locationWarning: { color: colors.warning, fontSize: 12, marginBottom: 8 },
    errorText: { color: colors.danger, fontSize: 12, marginBottom: 8 },
    submit: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    submitDisabled: { opacity: 0.45 },
    submitText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
    cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    cancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
