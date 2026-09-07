import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { SocialAuthorizeResponse, SocialLink, SocialProvider, UserProfile } from '@g88/shared';

import { deleteJson, getJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { SOCIAL_PROVIDER_CONFIG } from '@/features/profile/socialConfig';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing, radius } from '@/theme';

const PROVIDERS = Object.keys(SOCIAL_PROVIDER_CONFIG) as SocialProvider[];

export function SocialLinkingScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const links = useAppSelector((s) => s.profile.profile?.socialLinks ?? []);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchProfile());
    }, [dispatch]),
  );

  const linkFor = (p: SocialProvider): SocialLink | undefined => links.find((l) => l.provider === p);

  const connect = async (provider: SocialProvider): Promise<void> => {
    setBusy(provider);
    setError(null);
    try {
      const res = await getJson<SocialAuthorizeResponse>(`/social/${provider}/start`);
      const ok = await Linking.canOpenURL(res.url);
      if (ok) await Linking.openURL(res.url);
      else setError('Could not open the provider login.');
    } catch (e) {
      setError(extractMessage(e, `${provider} linking is unavailable right now.`));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = (provider: SocialProvider): void => {
    appAlert('Disconnect', `Remove your ${SOCIAL_PROVIDER_CONFIG[provider].label} link?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy(provider);
          setError(null);
          try {
            await deleteJson<UserProfile>(`/social/${provider}`);
            await dispatch(fetchProfile());
          } catch (e) {
            setError(extractMessage(e, 'Could not disconnect.'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Connected Accounts" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Link your accounts to boost your trust score.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {PROVIDERS.map((provider) => {
          const cfg = SOCIAL_PROVIDER_CONFIG[provider];
          const link = linkFor(provider);
          const connected = !!link;
          return (
            <View key={provider} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: cfg.color }]}>
                <Icon name={cfg.icon} size={22} color={colors.textPrimary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{cfg.label}</Text>
                {connected && link?.username ? (
                  <Text style={styles.username}>@{link.username}</Text>
                ) : (
                  <Text style={styles.notLinked}>Not connected</Text>
                )}
              </View>
              {busy === provider ? (
                <ActivityIndicator color={colors.primary} />
              ) : connected ? (
                <TouchableOpacity onPress={() => disconnect(provider)}>
                  <Text style={styles.disconnect}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.connectBtn} onPress={() => void connect(provider)}>
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  intro: {
    color: colors.textMuted,
    fontSize: fontSize.md - 1,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 14 },
  name: { color: colors.textPrimary, fontSize: fontSize.md + 1, fontWeight: '600' },
  username: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  notLinked: { color: colors.textFaint, fontSize: fontSize.sm, marginTop: 2 },
  connectBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill - 4,
  },
  connectText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  disconnect: { color: colors.danger, fontWeight: '600', fontSize: fontSize.sm },
});
