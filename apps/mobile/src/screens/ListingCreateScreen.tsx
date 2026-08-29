// apps/mobile/src/screens/ListingCreateScreen.tsx
//
// P3.7 listing creation. Dependency-free inputs + a draggable map pin for the
// item location (react-native-maps, already a dep). No payment fields — price is
// just a number; settlement is offline (offer-based v1).
// Supports mode: 'sell' | 'buy' from route params (Create nearby sheet).
// NOTE: backend CreateListingDto has no `mode` field and ValidationPipe uses
// forbidNonWhitelisted — do NOT send mode in the request body.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { LISTING_LIMITS, type CreateListingRequest, type LatLng } from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useUserLocation } from '@/features/location/useUserLocation';
import { createListing } from '@/features/trading/useTrading';
import { pickAndUploadListingImage } from '@/features/trading/listingImage';

type Nav = NativeStackNavigationProp<CommerceStackParamList>;
type R = RouteProp<CommerceStackParamList, 'ListingCreate'>;

const FALLBACK: LatLng = { lat: 43.21, lng: 27.92 };
const CATEGORIES = ['Electronics', 'Furniture', 'Clothing', 'Sports', 'Home', 'Books', 'Other'] as const;
const CURRENCIES = ['USD', 'EUR', 'BGN', 'GBP'] as const;

/** Surface buy-intent in the title until backend supports a real `mode` column. */
function titleForMode(raw: string, mode: 'sell' | 'buy'): string {
  const t = raw.trim();
  if (mode !== 'buy') return t;
  if (/^wanted\s*:/i.test(t)) return t;
  return `Wanted: ${t}`;
}

export function ListingCreateScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { coords } = useUserLocation();
  const mapRef = useRef<MapView>(null);
  const hasCentered = useRef(false);

  const mode = route.params?.mode === 'buy' ? 'buy' : 'sell';
  const initialLocation = route.params?.initialLocation;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [category, setCategory] = useState<string>(mode === 'buy' ? 'Other' : 'Electronics');
  const [pin, setPin] = useState<LatLng | null>(initialLocation ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venue = pin ?? coords ?? FALLBACK;
  const priceCents = useMemo(() => {
    const n = parseFloat(price);
    return Number.isNaN(n) ? NaN : Math.round(n * 100);
  }, [price]);

  const canSubmit =
    title.trim().length > 0 && !Number.isNaN(priceCents) && priceCents >= 0 && !submitting && !uploading;

  const onPickPhoto = useCallback(async () => {
    setUploading(true);
    setError(null);
    try {
      const url = await pickAndUploadListingImage();
      if (url) setThumbnailUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Never send `mode` — CreateListingDto has no such field and the global
      // ValidationPipe uses forbidNonWhitelisted (400 on unknown props).
      const req: CreateListingRequest = {
        title: titleForMode(title, mode),
        priceCents,
        currency,
        category,
        location: venue,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      };
      const created = await createListing(req);
      nav.replace('ListingDetail', { listingId: created.id });
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Could not create the listing. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, title, priceCents, currency, category, venue, description, thumbnailUrl, nav, mode]);

  const onDragEnd = useCallback((c: RNLatLng) => setPin({ lat: c.latitude, lng: c.longitude }), []);

  useEffect(() => {
    const target = initialLocation ?? coords;
    if (target && !hasCentered.current) {
      hasCentered.current = true;
      mapRef.current?.animateToRegion(
        { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        400,
      );
    }
  }, [coords, initialLocation]);

  const headerTitle = mode === 'buy' ? 'Looking to buy' : 'Sell an item';
  const titlePlaceholder = mode === 'buy' ? 'What are you looking for?' : 'What are you selling?';
  const submitLabel = mode === 'buy' ? 'Post' : 'List';

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Icon name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{headerTitle}</Text>
        <TouchableOpacity onPress={() => void onSubmit()} disabled={!canSubmit} hitSlop={8}>
          {submitting ? (
            <ActivityIndicator size="small" color="#00d4ff" />
          ) : (
            <Text style={[S.create, !canSubmit && S.createDisabled]}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
        <Text style={S.label}>Photo <Text style={S.optional}>(optional)</Text></Text>
        <TouchableOpacity
          style={S.photoWrap}
          onPress={() => void onPickPhoto()}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {thumbnailUrl ? (
            <>
              <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
                <Text style={S.photoEmptyText}>Add a photo</Text>
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
          placeholder={titlePlaceholder}
          placeholderTextColor="#555"
          value={title}
          onChangeText={setTitle}
          maxLength={LISTING_LIMITS.titleMax}
          autoFocus
        />

        <Text style={S.label}>{mode === 'buy' ? 'Budget' : 'Price'}</Text>
        <View style={S.priceRow}>
          <TextInput
            style={[S.input, { flex: 1 }]}
            placeholder="0.00"
            placeholderTextColor="#555"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
            {CURRENCIES.map((c) => (
              <Chip key={c} active={c === currency} label={c} onPress={() => setCurrency(c)} />
            ))}
          </ScrollView>
        </View>

        <Text style={S.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={c === category} label={c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>

        <Text style={S.label}>Description <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={[S.input, S.multiline]}
          placeholder={mode === 'buy' ? 'Condition, preferred pickup, details…' : 'Condition, details, pickup notes…'}
          placeholderTextColor="#555"
          value={description}
          onChangeText={setDescription}
          maxLength={LISTING_LIMITS.descriptionMax}
          multiline
          textAlignVertical="top"
        />

        <Text style={S.label}>Location <Text style={S.optional}>(drag the pin)</Text></Text>
        <View style={S.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: venue.lat, longitude: venue.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          >
            <Marker
              draggable
              coordinate={{ latitude: venue.lat, longitude: venue.lng }}
              onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate)}
            />
          </MapView>
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
  photoWrap: {
    height: 160, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
    alignItems: 'center', justifyContent: 'center',
  },
  photoEmpty: { alignItems: 'center', gap: 8 },
  photoEmptyText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  photoUploading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  photoEditBadge: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,10,15,0.7)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  photoEditText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
