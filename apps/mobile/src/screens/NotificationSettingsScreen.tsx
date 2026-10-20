// apps/mobile/src/screens/NotificationSettingsScreen.tsx
//
// P3.3 mobile surfacing: per-channel push opt-out toggles, driven by the shared
// NOTIFICATION_CHANNELS list and backed by /notifications/preferences.

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
import { fontSize, spacing, useAppTheme, type ThemeColors } from '@/theme';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    content: { paddingBottom: 40 },
    intro: {
      color: colors.textMuted,
      fontSize: fontSize.md - 1,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    error: {
      color: colors.danger,
      fontSize: fontSize.md - 1,
      textAlign: 'center',
      marginTop: 40,
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
        <Text style={styles.intro}>Choose which push notifications you want to receive.</Text>

        {loading && !prefs ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : !prefs ? (
          <Text style={styles.error}>Couldn't load your notification settings.</Text>
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
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Switch
                        value={prefs[channel]}
                        onValueChange={(value) => void setChannel(channel, value)}
                        trackColor={{ false: colors.borderStrong, true: colors.primaryTrack }}
                        thumbColor={prefs[channel] ? colors.primary : colors.textFaint}
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
