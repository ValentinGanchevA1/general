import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, fontSize } from '@/theme';

interface MapPresenceCardProps {
  isVisible: boolean;
  saving?: boolean;
  onToggle: (value: boolean) => void;
  onViewPin?: () => void;
}

export function MapPresenceCard({
  isVisible,
  saving = false,
  onToggle,
  onViewPin,
}: MapPresenceCardProps): React.JSX.Element {
  return (
    <View style={[styles.card, isVisible ? styles.cardOn : styles.cardOff]}>
      <View style={styles.titleRow}>
        <View style={[styles.statusDot, { backgroundColor: isVisible ? colors.success : colors.textFaint }]} />
        <Text style={styles.title}>How others see you</Text>
        {saving ? <ActivityIndicator size="small" color={colors.primary} style={styles.saving} /> : null}
      </View>

      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.label}>Visible on map</Text>
          <Text style={styles.subtitle}>
            {isVisible
              ? 'People nearby can see your photo and wave you'
              : 'You are currently hidden from the map'}
          </Text>
        </View>
        <Switch
          value={isVisible}
          onValueChange={onToggle}
          disabled={saving}
          trackColor={{ false: colors.textFaint, true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.textFaint}
        />
      </View>

      {isVisible && onViewPin ? (
        <Pressable onPress={onViewPin} style={styles.viewPinButton} accessibilityRole="button">
          <Icon name="map-marker" size={16} color={colors.primary} />
          <Text style={styles.viewPinText}>View my pin on map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  cardOn: { borderColor: 'rgba(0, 212, 255, 0.35)' },
  cardOff: { borderColor: colors.border },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  saving: { marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  viewPinButton: {
    marginTop: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
  },
  viewPinText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
