// apps/mobile/src/screens/EventCreateScreen.tsx
//
// P3.5 event creation. Deliberately dependency-free on the datetime side —
// day/time/duration chips instead of a native @react-native-community
// datetimepicker (a native module = an Android rebuild on the RN 0.83 surface,
// per CLAUDE.md). The venue pin uses react-native-maps (already a dep) with a
// draggable marker, defaulting to long-press location or GPS.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng as RNLatLng } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { EVENT_LIMITS, type CreateEventRequest, type LatLng } from '@g88/shared';
import type { EventsStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { createEvent } from '@/features/events/useEvents';
import { pickAndUploadListingImage } from '@/features/trading/listingImage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FormField } from '@/components/FormField';
import { colors } from '@/theme';

type Nav = NativeStackNavigationProp<EventsStackParamList>;
type Route = NativeStackScreenProps<EventsStackParamList, 'EventCreate'>['route'];

const FALLBACK: LatLng = { lat: 43.21, lng: 27.92 };

const DURATIONS = [
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: '4h', hours: 4 },
  { label: 'All day', hours: 8 },
] as const;

function dayLabel(d: Date, idx: number): string {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function EventCreateScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const initialLocation = route.params?.initialLocation;
  const { coords } = useUserLocation();
  const mapRef = useRef<MapView>(null);
  const hasCentered = useRef(false);
  const descriptionRef = useRef<TextInput>(null);
  const capacityRef = useRef<TextInput>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [dayIdx, setDayIdx] = useState(0);
  const [minutes, setMinutes] = useState(18 * 60);
  const [durationIdx, setDurationIdx] = useState(1);
  // Prefer long-press pin from Create nearby sheet over GPS.
  const [pin, setPin] = useState<LatLng>(initialLocation ?? coords ?? FALLBACK);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const venue = pin;

  const startsAt = useMemo(() => {
    const d = new Date(days[dayIdx] ?? days[0]!);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  }, [days, dayIdx, minutes]);

  const canSubmit = title.trim().length > 0 && !submitting && !uploading;

  const onPickPhoto = useCallback(async () => {
    setUploading(true);
    setError(null);
    try {
      const url = await pickAndUploadListingImage();
      if (url) setCoverUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    if (startsAt.getTime() <= Date.now()) {
      setError('Pick a start time in the future.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const dur = DURATIONS[durationIdx] ?? DURATIONS[0];
      const endsAt = new Date(startsAt.getTime() + dur.hours * 3_600_000);
      const cap = capacity.trim() ? parseInt(capacity.trim(), 10) : undefined;
      const req: CreateEventRequest = {
        title: title.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: venue,
        visibility,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(cap != null && !Number.isNaN(cap) ? { capacity: cap } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      };
      const created = await createEvent(req);
      nav.replace('EventDetail', { eventId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, durationIdx, startsAt, capacity, title, venue, visibility, description, coverUrl, nav]);

  const onDragEnd = useCallback((c: RNLatLng) => {
    setPin({ lat: c.latitude, lng: c.longitude });
  }, []);

  // Pin is seeded from initialLocation (long-press) or coords at mount.
  // Effect only animates the map camera — no setState (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (hasCentered.current) return;
    const target = initialLocation ?? coords;
    if (!target) return;
    hasCentered.current = true;
    mapRef.current?.animateToRegion(
      { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400,
    );
  }, [coords, initialLocation]);

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="New event"
        right={
          <TouchableOpacity
            onPress={() => { void onSubmit(); }}
            disabled={!canSubmit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Create event"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[S.saveLink, !canSubmit && S.saveDisabled]}>Create</Text>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="What's happening?"
          maxLength={EVENT_LIMITS.titleMax}
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current?.focus()}
          testID="event-create-title"
        />

        <FormField
          ref={descriptionRef}
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          multiline
          maxLength={EVENT_LIMITS.descriptionMax}
          style={S.bio}
          returnKeyType="next"
          onSubmitEditing={() => capacityRef.current?.focus()}
          testID="event-create-description"
        />

        <Text style={S.label}>When</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[S.chip, dayIdx === i && S.chipActive]}
              onPress={() => setDayIdx(i)}
            >
              <Text style={[S.chipText, dayIdx === i && S.chipTextActive]}>{dayLabel(d, i)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
          {[9 * 60, 12 * 60, 15 * 60, 18 * 60, 20 * 60, 21 * 60].map((m) => (
            <TouchableOpacity
              key={m}
              style={[S.chip, minutes === m && S.chipActive]}
              onPress={() => setMinutes(m)}
            >
              <Text style={[S.chipText, minutes === m && S.chipTextActive]}>{timeLabel(m)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={S.label}>Duration</Text>
        <View style={S.chips}>
          {DURATIONS.map((d, i) => (
            <TouchableOpacity
              key={d.label}
              style={[S.chip, durationIdx === i && S.chipActive]}
              onPress={() => setDurationIdx(i)}
            >
              <Text style={[S.chipText, durationIdx === i && S.chipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FormField
          ref={capacityRef}
          label="Capacity (optional)"
          value={capacity}
          onChangeText={setCapacity}
          placeholder="Unlimited"
          keyboardType="number-pad"
          testID="event-create-capacity"
        />

        <Text style={S.label}>Visibility</Text>
        <View style={S.chips}>
          {(['public', 'private'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[S.chip, visibility === v && S.chipActive]}
              onPress={() => setVisibility(v)}
            >
              <Text style={[S.chipText, visibility === v && S.chipTextActive]}>
                {v === 'public' ? 'Public on map' : 'Private'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={S.label}>Venue pin</Text>
        <Text style={S.hint}>
          {initialLocation
            ? 'Pinned from the map long-press. Drag to adjust.'
            : 'Drag the pin to set the venue. Defaults to your location.'}
        </Text>
        <View style={S.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={S.map}
            initialRegion={{
              latitude: pin.lat,
              longitude: pin.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              draggable
              onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate)}
            />
          </MapView>
        </View>

        <Text style={S.label}>Cover photo</Text>
        <TouchableOpacity style={S.photoBtn} onPress={() => { void onPickPhoto(); }} disabled={uploading}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={S.photo} />
          ) : (
            <View style={S.photoPlaceholder}>
              <Icon name="camera-plus-outline" size={28} color={colors.primary} />
              <Text style={S.photoPlaceholderText}>{uploading ? 'Uploading…' : 'Add cover'}</Text>
            </View>
          )}
          {coverUrl ? (
            <View style={S.photoEdit}>
              <Icon name="pencil" size={14} color={colors.textPrimary} />
              <Text style={S.photoEditText}>Change</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {error ? <Text style={S.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  saveLink: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  saveDisabled: { color: colors.textFaint },
  scroll: { padding: 16, gap: 10, paddingBottom: 48 },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 6 },
  bio: { minHeight: 88, textAlignVertical: 'top' as const },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.primary },
  mapWrap: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  map: { flex: 1 },
  photoBtn: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText: { color: colors.textMuted, fontWeight: '600' },
  photoEdit: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  photoEditText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 8 },
});
