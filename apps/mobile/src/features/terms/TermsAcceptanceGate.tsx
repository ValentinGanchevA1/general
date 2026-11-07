import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet,
  Switch, Text, View,
} from 'react-native';
import { acceptTerms, loadTermsStatus } from './termsSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAppTheme } from '@/theme';

/**
 * Re-checks current, server-authoritative Terms on login and app foreground.
 * Read-only navigation remains available after deferral; backend denies all
 * protected UGC mutations until affirmative versioned acceptance is persisted.
 */
export function TermsAcceptanceGate({ userId }: { userId: string }): React.JSX.Element | null {
  const dispatch = useAppDispatch();
  const { colors } = useAppTheme();
  const { status, loading, submitting, error } = useAppSelector(s => s.terms);
  const [agreed, setAgreed] = useState(false);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    setAgreed(false);
    setDeferred(false);
    void dispatch(loadTermsStatus());
  }, [dispatch, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void dispatch(loadTermsStatus());
    });
    return () => sub.remove();
  }, [dispatch]);

  const current = status?.required === true && status.configured &&
    status.enforcementEnabled && Boolean(status.url) && Boolean(status.version);

  const openTerms = useCallback(() => {
    const url = status?.url;
    if (url?.startsWith('https://')) void Linking.openURL(url).catch(() => undefined);
  }, [status?.url]);

  const submit = useCallback(async () => {
    if (!agreed || !status?.version) return;
    const result = await dispatch(acceptTerms({
      version: status.version, accepted: true, channel: 'mobile',
    }));
    if (acceptTerms.fulfilled.match(result)) {
      setAgreed(false);
      void dispatch(loadTermsStatus());
    }
  }, [agreed, dispatch, status?.version]);

  if (!current || deferred || loading) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDeferred(true)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={styles.contents} keyboardShouldPersistTaps="handled">
            <Text style={[styles.eyebrow, { color: colors.actionPrimary }]}>NEXUS · COMMUNITY</Text>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Review our updated Terms</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Before publishing a profile, story, message or other content,
              please review the current Terms of Service and our community rules.
            </Text>
            <Text style={[styles.version, { color: colors.textSecondary }]}>Version: {status?.version}</Text>
            <Pressable accessibilityRole="link" onPress={openTerms} style={styles.linkButton}>
              <Text style={[styles.link, { color: colors.actionPrimary }]}>Read the full Terms of Service ↗</Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel="I have read and agree to the Terms of Service"
              style={styles.consentRow}
              onPress={() => setAgreed(value => !value)}
            >
              <Switch
                value={agreed}
                onValueChange={setAgreed}
                accessibilityLabel="Accept Terms of Service"
              />
              <Text style={[styles.consentText, { color: colors.textPrimary }]}>
                I have read and agree to these Terms, including the community rules.
              </Text>
            </Pressable>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept Terms and continue"
              accessibilityState={{ disabled: !agreed || submitting }}
              disabled={!agreed || submitting}
              style={[styles.primary, { backgroundColor: colors.primary }, (!agreed || submitting) && styles.disabled]}
              onPress={() => { void submit(); }}
            >
              {submitting ? <ActivityIndicator color={colors.onPrimary} /> :
                <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>Accept and continue</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue read-only without accepting"
              style={styles.secondary}
              onPress={() => setDeferred(true)}
            >
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
                Not now — continue read-only
              </Text>
            </Pressable>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              You can still explore NEXUS without agreeing, but creating or
              sharing content is unavailable until you accept.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,7,15,0.87)', padding: 18, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 540, alignSelf: 'center', borderRadius: 20, borderWidth: 1, maxHeight: '88%' },
  contents: { padding: 24, gap: 16 },
  eyebrow: { fontWeight: '800', fontSize: 11, letterSpacing: 2 },
  heading: { fontSize: 26, fontWeight: '800', lineHeight: 31 },
  body: { fontSize: 15, lineHeight: 23 },
  version: { fontSize: 12 },
  linkButton: { minHeight: 44, justifyContent: 'center' },
  link: { textDecorationLine: 'underline', fontWeight: '700', fontSize: 15 },
  consentRow: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 54 },
  consentText: { flex: 1, lineHeight: 22, fontSize: 14 },
  error: { color: '#ff7a83', fontSize: 14 },
  primary: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  primaryLabel: { fontWeight: '800', fontSize: 15 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontWeight: '600' },
  hint: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
