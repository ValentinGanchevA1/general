// apps/mobile/src/screens/AlertComposerScreen.tsx

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AREA_CATEGORIES, type AreaCategory } from '@g88/shared';
import type { CreateAlertRequest, AlertResponse } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch } from '@/hooks/redux';
import { setPendingFilter } from '@/features/pulse/pulseSlice';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { postJson } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'AlertComposer'>;

const CATEGORY_META: Record<
  AreaCategory,
  { label: string; icon: string }
> = {
  general:  { label: 'General',  icon: 'bullhorn-outline' },
  safety:   { label: 'Safety',   icon: 'shield-alert-outline' },
  traffic:  { label: 'Traffic',  icon: 'car-outline' },
  weather:  { label: 'Weather',  icon: 'weather-partly-cloudy' },
  event:    { label: 'Event',    icon: 'calendar-outline' },
  business: { label: 'Business', icon: 'storefront-outline' },
  news:     { label: 'News',     icon: 'newspaper-variant-outline' },
};

export function AlertComposerScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const dispatch = useAppDispatch();

  const [category, setCategory] = useState<AreaCategory>(
    route.params?.presetCategory ?? 'general',
  );
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(route.params?.presetTag ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<TextInput>(null);

  const canSubmit = body.trim().length > 0 && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const req: CreateAlertRequest = {
        category,
        body: body.trim(),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
      };
      await postJson<CreateAlertRequest, AlertResponse>('/alerts', req);
      // Nudge the daily-challenge banner ("Post an area alert" / "Post 2 area alerts").
      challengeEvents.emit('progress');
      dispatch(setPendingFilter('alerts'));
      nav.navigate('Main', { screen: 'Pulse' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, body, tag, dispatch, nav]);

  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader
        title="Post an alert"
        bordered
        onBack={() => nav.goBack()}
        right={
          <TouchableOpacity
            onPress={() => { void onSubmit(); }}
            disabled={!canSubmit}
            testID="alert-composer-submit"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Post alert"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[S.postBtn, !canSubmit && S.postBtnDisabled]}>Post</Text>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Category chips ────────────────────────────────────────── */}
        <Text style={S.sectionLabel}>Category</Text>
        <View style={S.chipRow}>
          {AREA_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = cat === category;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                testID={`alert-category-${cat}`}
                style={[S.chip, active && S.chipActive]}
              >
                <MCI
                  name={meta.icon}
                  size={16}
                  color={active ? '#0a0a0f' : '#aaa'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[S.chipLabel, active && S.chipLabelActive]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Body ──────────────────────────────────────────────────── */}
        <Text style={S.sectionLabel}>What\'s happening?</Text>
        <TextInput
          ref={bodyRef}
          style={S.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Describe the situation near you…"
          placeholderTextColor="#555"
          multiline
          maxLength={500}
          textAlignVertical="top"
          testID="alert-body-input"
        />
        <Text style={S.charCount}>{body.length}/500</Text>

        {/* ─── Optional tag ──────────────────────────────────────────── */}
        <Text style={S.sectionLabel}>
          Tag <Text style={S.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={S.tagInput}
          value={tag}
          onChangeText={setTag}
          placeholder="e.g. road-closed"
          placeholderTextColor="#555"
          maxLength={40}
          autoCapitalize="none"
          testID="alert-tag-input"
        />

        {error ? (
          <View style={S.errorRow}>
            <MCI name="alert-circle-outline" size={16} color="#ff6b6b" style={{ marginRight: 6 }} />
            <Text style={S.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  postBtn: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  postBtnDisabled: { color: colors.textFaint },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: { color: '#555', textTransform: 'none', fontWeight: '400' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: '#0a0a0f' },
  bodyInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: '#fff',
    padding: 14,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: 4 },
  tagInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  errorText: { color: '#ff6b6b', fontSize: 14, flex: 1 },
});
