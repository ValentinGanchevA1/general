import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, fontSize } from '@/theme';

interface MapPresenceCardProps {
  isVisible: boolean;
  onToggle: (value: boolean) => void;
  onViewPin?: () => void;
}

export function MapPresenceCard({
  isVisible,
  onToggle,
  onViewPin,
}: MapPresenceCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>How others see you</Text>

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
          trackColor={{ false: colors.textFaint, true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.textFaint}
        />
      </View>

      {isVisible && onViewPin ? (
        <Pressable onPress={onViewPin} style={styles.viewPinButton}>
          <Icon name="map-marker" size={16} color={colors.primary} />
          <Text style={styles.viewPinText}>View my pin on map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: 14,
  },
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
