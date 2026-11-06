import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, type ThemeColors } from '@/theme';
import type { PortalDetailProjection } from './portalDetailState';

interface Props {
  state: PortalDetailProjection;
  currentRsvp: 'going' | 'maybe' | 'declined' | null;
}

const STATUS_ICONS: Record<PortalDetailProjection['status'], string> = {
  upcoming: 'calendar-clock',
  started: 'clock-check-outline',
  'at-capacity': 'account-group-outline',
  ended: 'calendar-remove-outline',
  'schedule-unavailable': 'calendar-question',
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginTop: 14,
      padding: 16,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.discoveryBorderSoft,
      borderRadius: 16,
      gap: 10,
    },
    eyebrow: {
      color: colors.discovery,
      fontWeight: '800',
      letterSpacing: 1.1,
      fontSize: 11,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    status: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      flex: 1,
    },
    body: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    footnote: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  });
}

/**
 * Presentation only. Renders the authenticated EventDetail state and offers
 * no RSVP/visibility side effects. World palettes will flow via useAppTheme.
 */
export function PortalEntryBanner({ state, currentRsvp }: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card} testID="portal-entry-banner">
      <Text style={styles.eyebrow}>NEXA / PORTAL EXPERIENCE</Text>
      <View style={styles.statusRow}>
        <Icon
          name={STATUS_ICONS[state.status]}
          size={20}
          color={state.status === 'ended' || state.status === 'at-capacity'
            ? colors.warning
            : colors.entityEvent}
        />
        <Text style={styles.status} accessibilityRole="header" testID="portal-detail-status">
          {state.statusLabel}
        </Text>
      </View>
      <Text style={styles.body}>{state.description}</Text>
      {currentRsvp != null ? (
        <Text style={styles.footnote}>
          Your current RSVP: {currentRsvp}. Entering the Portal does not change it.
        </Text>
      ) : (
        <Text style={styles.footnote}>
          Viewing this Portal does not RSVP or share your activity.
        </Text>
      )}
    </View>
  );
}
