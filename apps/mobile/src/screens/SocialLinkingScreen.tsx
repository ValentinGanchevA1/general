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
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  SocialAuthorizeResponse,
  SocialLink,
  SocialProvider,
  UserProfile,
} from '@g88/shared';
import { deleteJson, getJson } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchProfile } from '@/features/profile/profileSlice';
import { SOCIAL_PROVIDER_CONFIG } from '@/features/profile/socialConfig';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';
import { appAlert } from '@/ui/appAlert';
import { extractMessage } from '@/utils/extractMessage';

const PROVIDERS = Object.keys(SOCIAL_PROVIDER_CONFIG) as SocialProvider[];

export function SocialLinkingScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const dispatch = useAppDispatch();
  const links = useAppSelector((state) => state.profile.profile?.socialLinks ?? []);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchProfile());
    }, [dispatch]),
  );

  const linkFor = (provider: SocialProvider): SocialLink | undefined =>
    links.find((link) => link.provider === provider);

  const connect = async (provider: SocialProvider): Promise<void> => {
    setBusy(provider);
    setError(null);
    try {
      const response = await getJson<SocialAuthorizeResponse>(`/social/${provider}/start`);
      const canOpen = await Linking.canOpenURL(response.url);
      if (canOpen) {
        await Linking.openURL(response.url);
      } else {
        setError('Could not open the provider login.');
      }
    } catch (e: unknown) {
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
          } catch (e: unknown) {
            setError(extractMessage(e, 'Could not disconnect.'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScreenHeader title="Connected profiles" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View
          style={[
            styles.identityNote,
            {
              backgroundColor: colors.discoverySoft,
              borderColor: colors.discoveryBorderSoft,
            },
          ]}
        >
          <Icon name="account-link-outline" size={22} color={colors.discovery} />
          <View style={styles.identityNoteBody}>
            <Text style={[styles.identityNoteTitle, { color: colors.textPrimary }]}>Supporting signal</Text>
            <Text style={[styles.identityNoteText, { color: colors.textSecondary }]}> 
              Connected profiles can strengthen identity context, but they are optional and never replace government ID verification.
            </Text>
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.list}>
          {PROVIDERS.map((provider) => {
            const config = SOCIAL_PROVIDER_CONFIG[provider];
            const link = linkFor(provider);
            const connected = link != null;

            return (
              <View
                key={provider}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surfacePrimary,
                    borderColor: connected ? colors.discoveryBorderSoft : colors.borderDefault,
                  },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: config.color }]}>
                  <Icon name={config.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{config.label}</Text>
                    {connected ? (
                      <Icon name="check-circle" size={15} color={colors.verified} />
                    ) : null}
                  </View>
                  {connected && link.username ? (
                    <Text style={[styles.username, { color: colors.textSecondary }]}>
                      @{link.username}
                    </Text>
                  ) : (
                    <Text style={[styles.notLinked, { color: colors.textTertiary }]}>Not connected</Text>
                  )}
                </View>
                {busy === provider ? (
                  <ActivityIndicator color={colors.discovery} />
                ) : connected ? (
                  <TouchableOpacity
                    style={styles.textAction}
                    onPress={() => disconnect(provider)}
                    accessibilityRole="button"
                    accessibilityLabel={`Disconnect ${config.label}`}
                  >
                    <Text style={[styles.disconnect, { color: colors.danger }]}>Disconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: colors.actionPrimary }]}
                    onPress={() => void connect(provider)}
                    accessibilityRole="button"
                    accessibilityLabel={`Connect ${config.label}`}
                  >
                    <Text style={[styles.connectText, { color: colors.onPrimary }]}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  identityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  identityNoteBody: { flex: 1 },
  identityNoteTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  identityNoteText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  error: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 14 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: fontSize.md + 1,
    fontWeight: '600',
  },
  username: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  notLinked: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  connectButton: {
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectText: {
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  textAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  disconnect: {
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
});
