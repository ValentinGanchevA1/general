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

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'AlertComposer'>;

const BODY_MAX = 280;
const TAG_MAX = 60;

const CATEGORY_META: Record<AreaCategory, { label: string; icon: string }> = {
  general:  { label: 'General',  icon: 'information-outline' },
  food:     { label: 'Food',     icon: 'food-fork-drink' },
  events:   { label: 'Events',   icon: 'calendar-star' },
  help:     { label: 'Help',     icon: 'hand-heart-outline' },
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
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          testID="alert-composer-back"
          hitSlop={8}
        >
          <MCI name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={S.headerTitle}>Post an alert</Text>

        <TouchableOpacity
          onPress={() => { void onSubmit(); }}
          disabled={!canSubmit}
          testID="alert-composer-submit"
          hitSlop={8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#00d4ff" />
          ) : (
            <Text style={[S.postBtn, !canSubmit && S.postBtnDisabled]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Category picker ────────────────────────────────────── */}
        <Text style={S.sectionLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.chips}
        >
          {AREA_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = cat === category;
            return (
              <Pressable
                key={cat}
                style={[S.chip, active && S.chipActive]}
                onPress={() => setCategory(cat)}
                testID={`alert-category-${cat}`}
              >
                <MCI
                  name={meta.icon}
                  size={16}
                  color={active ? '#0a0a0f' : '#aaa'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[S.chipText, active && S.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Body input ─────────────────────────────────────────── */}
        <Text style={S.sectionLabel}>What's happening?</Text>
        <Pressable onPress={() => bodyRef.current?.focus()}>
          <TextInput
            ref={bodyRef}
            style={S.bodyInput}
            placeholder="Share a local alert, tip, or update…"
            placeholderTextColor="#555"
            multiline
            maxLength={BODY_MAX}
            value={body}
            onChangeText={setBody}
            textAlignVertical="top"
            testID="alert-body-input"
            autoFocus
          />
        </Pressable>
        {body.length > 0 && (
          <Text style={[S.charCount, body.length >= BODY_MAX - 20 && S.charCountWarn]}>
            {body.length}/{BODY_MAX}
          </Text>
        )}

        {/* ─── Tag input ──────────────────────────────────────────── */}
        <Text style={S.sectionLabel}>Topic tag <Text style={S.optional}>(optional)</Text></Text>
        <TextInput
          style={S.tagInput}
          placeholder="#open-mic, #garage-sale…"
          placeholderTextColor="#555"
          maxLength={TAG_MAX}
          value={tag}
          onChangeText={setTag}
          autoCapitalize="none"
          autoCorrect={false}
          testID="alert-tag-input"
        />

        {/* ─── Error ──────────────────────────────────────────────── */}
        {error && (
          <View style={S.errorBox}>
            <MCI name="alert-circle-outline" size={16} color="#ff6b6b" style={{ marginRight: 8 }} />
            <Text style={S.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  postBtn: { color: '#00d4ff', fontSize: 16, fontWeight: '700' },
  postBtnDisabled: { color: '#333' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },

  sectionLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  optional: { color: '#555', textTransform: 'none', fontWeight: '400' },

  chips: { paddingBottom: 4, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0f' },

  bodyInput: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
    borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, lineHeight: 22,
    minHeight: 120,
  },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: 4 },
  charCountWarn: { color: '#ff9f43' },

  tagInput: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
    borderRadius: 12, padding: 14, color: '#fff', fontSize: 15,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  errorText: { color: '#ff6b6b', fontSize: 14, flex: 1 },
});
