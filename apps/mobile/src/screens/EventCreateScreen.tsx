// apps/mobile/src/screens/EventCreateScreen.tsx
//
// P3.5 event creation. Deliberately dependency-free on the datetime side —
// day/time/duration chips instead of a native @react-native-community
// datetimepicker (a native module = an Android rebuild on the RN 0.83 surface,
// per CLAUDE.md). The venue pin uses react-native-maps (already a dep) with a
// draggable marker, defaulting to the user's current location.

import React, { useCallback, useMemo, useState } from 'react';
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
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng as RNLatLng } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { EVENT_LIMITS, type CreateEventRequest, type LatLng } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserLocation } from '@/features/location/useUserLocation';
import { createEvent } from '@/features/events/useEvents';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Varna center — fallback pin before a location fix lands.
const FALLBACK: LatLng = { lat: 43.21, lng: 27.92 };

const DURATIONS = [
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: 'All day', hours: 24 },
] as const;

function nextDays(count: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push(new Date(base.getTime() + i * 86_400_000));
  }
  return out;
}

function dayLabel(d: Date, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// 30-min slots, 06:00 → 23:30.
function timeSlots(): number[] {
  const out: number[] = [];
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) out.push(m);
  return out;
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function EventCreateScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { coords } = useUserLocation();

  const days = useMemo(() => nextDays(14), []);
  const slots = useMemo(() => timeSlots(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayIdx, setDayIdx] = useState(0);
  const [minutes, setMinutes] = useState(19 * 60); // default 7:00 PM
  const [durationIdx, setDurationIdx] = useState(1);
  const [capacity, setCapacity] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venue = pin ?? coords ?? FALLBACK;

  const startsAt = useMemo(() => {
    const d = new Date(days[dayIdx] ?? days[0]!);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  }, [days, dayIdx, minutes]);

  const canSubmit = title.trim().length > 0 && !submitting;

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
      };
      const created = await createEvent(req);
      nav.replace('EventDetail', { eventId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, durationIdx, startsAt, capacity, title, venue, visibility, description, nav]);

  const onDragEnd = useCallback((c: RNLatLng) => {
    setPin({ lat: c.latitude, lng: c.longitude });
  }, []);

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
        <Text style={S.label}>Title</Text>
        <TextInput
          style={S.input}
          placeholder="What's the event?"
          placeholderTextColor="#555"
          value={title}
          onChangeText={setTitle}
          maxLength={EVENT_LIMITS.titleMax}
          autoFocus
        />

        <Text style={S.label}>Description <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={[S.input, S.multiline]}
          placeholder="Details, what to bring, who it's for…"
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
          {slots.map((m) => (
            <Chip key={m} active={m === minutes} label={timeLabel(m)} onPress={() => setMinutes(m)} />
          ))}
        </ScrollView>

        <Text style={S.label}>Duration</Text>
        <View style={S.row}>
          {DURATIONS.map((d, i) => (
            <Chip key={d.label} active={i === durationIdx} label={d.label} onPress={() => setDurationIdx(i)} />
          ))}
        </View>

        <Text style={S.label}>Location <Text style={S.optional}>(drag the pin)</Text></Text>
        <View style={S.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            region={{
              latitude: venue.lat,
              longitude: venue.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              draggable
              coordinate={{ latitude: venue.lat, longitude: venue.lng }}
              onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate)}
            />
          </MapView>
        </View>

        <Text style={S.label}>Capacity <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={S.input}
          placeholder="Max attendees"
          placeholderTextColor="#555"
          value={capacity}
          onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
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
});
