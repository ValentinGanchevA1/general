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
import { colors, fontSize, spacing, radius } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'AlertComposer'>;

const BODY_MAX = 280;

export function AlertComposerScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const dispatch = useAppDispatch();

  const [category, setCategory] = useState<AreaCategory>(
    route.params?.presetCategory ?? 'safety',
  );
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(route.params?.presetTag ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<TextInput>(null);

  const canSubmit = body.trim().length >= 3 && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateAlertRequest = {
        category,
        body: body.trim(),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
      };
      await postJson<CreateAlertRequest, AlertResponse>('/alerts', payload);
      challengeEvents.emit('alert_posted');
      dispatch(setPendingFilter('alerts'));
      nav.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post alert');
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, category, dispatch, nav, tag]);

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
        <Text style={S.label}>Category</Text>
        <View style={S.chips}>
          {AREA_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[S.chip, active && S.chipActive]}
              >
                <Text style={[S.chipText, active && S.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={S.label}>What's happening?</Text>
        <TextInput
          ref={bodyRef}
          style={S.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Describe the situation nearby…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={BODY_MAX}
          textAlignVertical="top"
        />
        <Text style={[S.charCount, body.length > BODY_MAX - 40 && S.charCountWarn]}>
          {body.length}/{BODY_MAX}
        </Text>

        <Text style={S.label}>
          Tag <Text style={S.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={S.tagInput}
          value={tag}
          onChangeText={setTag}
          placeholder="e.g. traffic, weather"
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          autoCapitalize="none"
        />

        {error ? (
          <View style={S.errorRow}>
            <MCI name="alert-circle-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={S.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  postBtn: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  postBtnDisabled: { color: colors.textFaint },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: spacing.md,
  },
  optional: { color: colors.textFaint, textTransform: 'none', fontWeight: '400' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill ?? 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
  bodyInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    padding: 14,
    fontSize: fontSize.md,
    minHeight: 120,
  },
  charCount: { color: colors.textFaint, fontSize: 12, textAlign: 'right', marginTop: 4 },
  charCountWarn: { color: colors.warning },
  tagInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 14, flex: 1 },
});
