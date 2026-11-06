import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { EventMeta } from '@g88/shared';
import { useAppTheme, type ThemeColors } from '@/theme';
import { formatEventWhen } from '@/features/events/eventFormat';
import { resolvePortalPreview } from './portalPreview';

export interface PortalEventPreviewProps {
  meta: EventMeta;
  distanceLabel: string | null;
  onEnter: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    portalIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.entityEvent,
      backgroundColor: colors.discoverySoft,
    },
    portalLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    status: {
      alignSelf: 'flex-start',
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    information: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 14,
      gap: 10,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    infoText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 19,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    privacyNote: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}

/**
 * Event-backed map Portal. The preview only navigates to EventDetail.
 * It must never RSVP, publish to Pulse, or subscribe to another socket room.
 */
export function PortalEventPreview({
  meta,
  distanceLabel,
  onEnter,
}: PortalEventPreviewProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const preview = resolvePortalPreview(meta, Date.now());
  const validStart = Number.isFinite(Date.parse(meta.startsAt));
  const when = validStart ? formatEventWhen(meta.startsAt, null) : 'Schedule unavailable';

  return (
    <View style={styles.root} testID="portal-event-preview">
      <View style={styles.eyebrow}>
        <View style={styles.portalIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="door-open" color={colors.entityEvent} size={24} />
        </View>
        <Text style={styles.portalLabel}>NEXA / EVENT PORTAL</Text>
      </View>
      <Text
        style={styles.status}
        accessibilityLabel={`Event status: ${preview.statusLabel}`}
        testID="portal-event-status"
      >
        {preview.statusLabel}
      </Text>
      <Text style={styles.title} accessibilityRole="header">{meta.title}</Text>
      <Text style={styles.subtitle}>Explore this experience before choosing whether to RSVP.</Text>
      <View style={styles.information}>
        <View style={styles.infoRow}>
          <Icon name="calendar-clock" color={colors.entityEvent} size={18} />
          <Text style={styles.infoText}>{when}</Text>
        </View>
        {distanceLabel != null ? (
          <View style={styles.infoRow}>
            <Icon name="map-marker-distance" color={colors.entityEvent} size={18} />
            <Text style={styles.infoText}>Approximately {distanceLabel} away</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Icon name="account-group-outline" color={colors.entityEvent} size={18} />
          <Text style={styles.infoText}>
            {preview.goingLabel}{preview.capacityLabel != null ? ` · ${preview.capacityLabel}` : ''}
          </Text>
        </View>
        {meta.hostDisplayName?.trim() ? (
          <View style={styles.infoRow}>
            <Icon name="account-outline" color={colors.entityEvent} size={18} />
            <Text style={styles.infoText}>Hosted by {meta.hostDisplayName.trim()}</Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onEnter}
        style={styles.primaryButton}
        accessibilityRole="button"
        accessibilityLabel={`Explore Portal for ${meta.title}`}
        accessibilityHint="Opens event details. Does not reserve a place or publish your participation."
        testID="portal-event-enter"
      >
        <Icon name="door-open" color={colors.onPrimary} size={20} />
        <Text style={styles.primaryText}>Explore Portal</Text>
      </TouchableOpacity>
      <Text style={styles.privacyNote}>
        Entering a Portal does not RSVP or share your activity.
      </Text>
    </View>
  );
}
