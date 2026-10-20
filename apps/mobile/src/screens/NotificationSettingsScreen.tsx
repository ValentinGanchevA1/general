// apps/mobile/src/screens/NotificationSettingsScreen.tsx

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { NOTIFICATION_CHANNELS, NOTIFICATION_CHANNEL_META } from '@g88/shared';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    content: { paddingBottom: 40 },
    intro: {
      color: colors.textMuted,
      fontSize: fontSize.md - 1,
      lineHeight: 20,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    privacyCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
      backgroundColor: colors.discoverySoft,
    },
    privacyEyebrow: {
      color: colors.discovery,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    privacyBody: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontSize: fontSize.md - 1,
      textAlign: 'center',
      marginTop: 40,
      paddingHorizontal: spacing.xl,
    },
    list: { paddingHorizontal: spacing.lg, gap: 10 },
  });
}

export function NotificationSettingsScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { prefs, loading, saving, setChannel } = useNotificationPreferences();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose which NEXA signals can reach you when the app is closed.
        </Text>

        <View style={styles.privacyCard} accessibilityRole="summary">
          <Text style={styles.privacyEyebrow}>Private by default</Text>
          <Text style={styles.privacyBody}>
            Lock-screen copy stays intentionally minimal. Open NEXA to reveal message,
            trust and nearby details.
          </Text>
        </View>

        {loading && !prefs ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.discovery} />
        ) : !prefs ? (
          <Text style={styles.error}>
            Notification preferences are unavailable right now. Your current choices remain
            unchanged.
          </Text>
        ) : (
          <View style={styles.list}>
            {NOTIFICATION_CHANNELS.map((channel) => {
              const meta = NOTIFICATION_CHANNEL_META[channel];
              return (
                <ListRow
                  key={channel}
                  title={meta.label}
                  subtitle={meta.description}
                  trailing={
                    saving === channel ? (
                      <ActivityIndicator color={colors.discovery} />
                    ) : (
                      <Switch
                        value={prefs[channel]}
                        onValueChange={(value) => void setChannel(channel, value)}
                        trackColor={{
                          false: colors.borderStrong,
                          true: colors.primaryTrack,
                        }}
                        thumbColor={prefs[channel] ? colors.actionPrimary : colors.textFaint}
                        accessibilityLabel={meta.label}
                      />
                    )
                  }
                  accessibilityLabel={meta.label}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
