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

  useEffect(() => {
    if (hasCentered.current) return;
    const target = initialLocation ?? coords;
    if (!target) return;
    hasCentered.current = true;
    if (!initialLocation && coords) {
      setPin(coords);
    }
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
