// apps/mobile/src/screens/EventCreateScreen.tsx
//
// P3.5 event creation. Deliberately dependency-free on the datetime side —
// day/time/duration chips instead of a native @react-native-community
// datetimepicker (a native module = an Android rebuild on the RN 0.83 surface,
// per CLAUDE.md). The venue pin uses react-native-maps (already a dep) with a
// draggable marker, defaulting to the user's current location.

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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { EVENT_LIMITS, type CreateEventRequest, type LatLng } from '@g88/shared';
import type { EventsStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { createEvent } from '@/features/events/useEvents';
import { pickAndUploadListingImage } from '@/features/trading/listingImage';

type Nav = NativeStackNavigationProp<EventsStackParamList>;

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
  const { coords } = useUserLocation();
  const mapRef = useRef<MapView>(null);
  const hasCentered = useRef(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [dayIdx, setDayIdx] = useState(0);
  const [minutes, setMinutes] = useState(18 * 60);
  const [durationIdx, setDurationIdx] = useState(1);
  const [pin, setPin] = useState<LatLng>(coords ?? FALLBACK);
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

  useEffect(() => {
    if (coords && !hasCentered.current) {
      hasCentered.current = true;
      mapRef.current?.animateToRegion(
        { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        400,
      );
    }
  }, [coords]);

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Icon name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>New event</Text>
        <TouchableOpacity onPress={() => void onSubmit()} disabled={!canSubmit} hitSlop={8}>
          {submitting ? (
            <ActivityIndicator size="small" color="#00d4ff" />
          ) : (
            <Text style={[S.create, !canSubmit && S.createDisabled]}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
        <Text style={S.label}>Cover photo <Text style={S.optional}>(optional)</Text></Text>
        <TouchableOpacity
          style={S.photoWrap}
          onPress={() => void onPickPhoto()}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {coverUrl ? (
            <>
              <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {!uploading ? (
                <View style={S.photoEditBadge}>
                  <Icon name="camera" size={14} color="#fff" />
                  <Text style={S.photoEditText}>Change</Text>
                </View>
              ) : null}
            </>
          ) : (
            !uploading && (
              <View style={S.photoEmpty}>
                <Icon name="camera-plus-outline" size={28} color="#00d4ff" />
                <Text style={S.photoEmptyText}>Add a cover photo</Text>
              </View>
            )
          )}
          {uploading ? (
            <View style={S.photoUploading}>
              <ActivityIndicator color="#00d4ff" />
              <Text style={S.photoEmptyText}>Uploading…</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <Text style={S.label}>Title</Text>
        <TextInput
          style={S.input}
          placeholder="What is happening?"
          placeholderTextColor="#555"
          value={title}
          onChangeText={setTitle}
          maxLength={EVENT_LIMITS.titleMax}
          autoFocus
        />

        <Text style={S.label}>Description <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={[S.input, S.multiline]}
          placeholder="Tell people what to expect"
          placeholderTextColor="#555"
          value={description}
          onChangeText={setDescription}
          maxLength={EVENT_LIMITS.descriptionMax}
          multiline
          textAlignVertical="top"
        />

        <Text style={S.label}>Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
          {days.map((d, i) => (
            <Chip key={i} active={i === dayIdx} label={dayLabel(d, i)} onPress={() => setDayIdx(i)} />
          ))}
        </ScrollView>

        <Text style={S.label}>Start time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
          {Array.from({ length: 24 * 2 }, (_, i) => i * 30).map((m) => (
            <Chip key={m} active={m === minutes} label={timeLabel(m)} onPress={() => setMinutes(m)} />
          ))}
        </ScrollView>

        <Text style={S.label}>Duration</Text>
        <View style={S.row}>
          {DURATIONS.map((d, i) => (
            <Chip key={d.label} active={i === durationIdx} label={d.label} onPress={() => setDurationIdx(i)} />
          ))}
        </View>

        <Text style={S.label}>Venue</Text>
        <View style={S.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: venue.lat,
              longitude: venue.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              coordinate={{ latitude: venue.lat, longitude: venue.lng }}
              draggable
              onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate)}
            />
          </MapView>
        </View>

        <Text style={S.label}>Capacity <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={S.input}
          placeholder="e.g. 20"
          placeholderTextColor="#555"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
        />

        <Text style={S.label}>Visibility</Text>
        <View style={S.row}>
          <Chip active={visibility === 'public'} label="Public" onPress={() => setVisibility('public')} />
          <Chip active={visibility === 'private'} label="Private" onPress={() => setVisibility('private')} />
        </View>

        {error ? (
          <View style={S.errorBox}>
            <Icon name="alert-circle-outline" size={16} color="#ff6b6b" style={{ marginRight: 8 }} />
            <Text style={S.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({
  active, label, onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={[S.chip, active && S.chipActive]} onPress={onPress}>
      <Text style={[S.chipText, active && S.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  create: { color: '#00d4ff', fontSize: 16, fontWeight: '700' },
  createDisabled: { color: '#333' },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  label: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  optional: { color: '#555', textTransform: 'none', fontWeight: '400' },

  input: {
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16,
  },
  multiline: { minHeight: 90 },

  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#2a2a4a',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0f' },

  mapWrap: { height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1f1f33' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
    borderRadius: 10, padding: 12, marginTop: 16,
  },
  errorText: { color: '#ff6b6b', fontSize: 14, flex: 1 },

  photoWrap: {
    height: 160, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
    justifyContent: 'center', alignItems: 'center',
  },
  photoEmpty: { alignItems: 'center', gap: 8 },
  photoEmptyText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  photoUploading: { alignItems: 'center', gap: 8 },
  photoEditBadge: {
    position: 'absolute', right: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  photoEditText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
