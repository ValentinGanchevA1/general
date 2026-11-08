import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import type { PersonalLabel } from '@g88/shared';
import { PERSONAL_LABEL_MAX_SELECTED } from '@g88/shared';
import { Config } from '@/config';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  clearPersonalLabelsFeedback, loadPersonalLabels, savePersonalLabels,
  suggestPersonalLabel,
} from '@/features/profile/personalLabelsSlice';
import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

function labelTitle(item: PersonalLabel): string {
  return [item.emoji, item.label].filter(Boolean).join(' ');
}

/** An isolated opt-in form. The released app renders nothing and makes no requests by default. */
export function PersonalLabelsEditor(): React.JSX.Element | null {
  const dispatch = useAppDispatch();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { enabled, catalog, selected, proposals, loading, saving, proposing, error, notice } =
    useAppSelector((state) => state.personalLabels);
  const [draft, setDraft] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    if (!Config.PERSONAL_LABELS_REQUESTED) return;
    void dispatch(loadPersonalLabels());
  }, [dispatch]);

  useEffect(() => {
    setDraft(selected.map((item) => item.key));
  }, [selected]);

  if (!Config.PERSONAL_LABELS_REQUESTED || (!enabled && !loading)) return null;

  const toggle = (key: string): void => {
    setDraft((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : current.length < PERSONAL_LABEL_MAX_SELECTED ? [...current, key] : current);
  };

  const save = (): void => { void dispatch(savePersonalLabels(draft)); };
  const submit = async (): Promise<void> => {
    const text = suggestion.trim();
    if (text.length < 3) return;
    const result = await dispatch(suggestPersonalLabel({ text, locale: 'en' }));
    if (suggestPersonalLabel.fulfilled.match(result)) setSuggestion('');
  };
  const changed = draft.join('|') !== selected.map((item) => item.key).join('|');

  return (
    <View style={styles.section} testID="personal-labels-editor">
      <Text style={styles.heading}>MY PERSONALITY</Text>
      <Text style={styles.help}>What makes you, you? Choose up to 5. Selected labels appear on your public profile and are not verified traits.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <View style={styles.tags}>
          {catalog.map((label) => {
            const active = draft.includes(label.key);
            return (
              <TouchableOpacity key={label.key}
                onPress={() => toggle(label.key)}
                accessibilityRole="button" accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipSelected]}
                testID={`personal-label-${label.key}`}>
                <Text style={[styles.chipText, active && styles.selectedText]}>{labelTitle(label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.help}>{draft.length}/{PERSONAL_LABEL_MAX_SELECTED} chosen</Text>
        <TouchableOpacity disabled={!changed || saving} onPress={save}
          accessibilityRole="button" style={[styles.button, (!changed || saving) && styles.buttonDisabled]}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Save labels</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.heading}>SUGGEST A LABEL</Text>
      <Text style={styles.help}>Missing a personality trait? Send a short suggestion. A moderator reviews it before publishing.</Text>
      <TextInput
        value={suggestion}
        onChangeText={(value) => { setSuggestion(value); if (error) dispatch(clearPersonalLabelsFeedback()); }}
        maxLength={40}
        placeholder="e.g. Deep thinker"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        testID="personal-labels-suggestion-input"
        accessibilityLabel="New personal label suggestion"
      />
      <View style={styles.row}>
        <Text style={styles.help}>{suggestion.length}/40</Text>
        <TouchableOpacity style={[styles.button, (proposing || suggestion.trim().length < 3) && styles.buttonDisabled]}
          disabled={proposing || suggestion.trim().length < 3} onPress={() => { void submit(); }}
          accessibilityRole="button" testID="personal-labels-suggestion-submit">
          {proposing ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Submit for review</Text>}
        </TouchableOpacity>
      </View>
      {notice ? <Text style={styles.success} accessibilityRole="text">{notice}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {proposals.length > 0 ? (
        <View style={styles.proposalBlock}>
          <Text style={styles.help}>YOUR SUGGESTIONS</Text>
          {proposals.slice(0, 5).map((item) => (
            <Text key={item.id} style={styles.proposal}>{item.text} · {item.status}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginTop: spacing.lg, gap: spacing.sm },
    heading: { color: colors.primary, fontWeight: '800', fontSize: 13, letterSpacing: 0.8 },
    help: { color: colors.textMuted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, borderWidth: 1 },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMutedBg },
    chipText: { color: colors.textPrimary, fontSize: 13 },
    selectedText: { color: colors.primary, fontWeight: '700' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    button: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 13, borderRadius: radius.md },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
    input: { color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44 },
    error: { color: colors.danger, fontSize: 12 },
    success: { color: colors.textPrimary, fontSize: 12 },
    proposalBlock: { marginTop: 8, gap: 4 },
    proposal: { color: colors.textSecondary, fontSize: 12 },
  });
}
