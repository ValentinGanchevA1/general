// apps/mobile/src/features/pulse/components/ShareCTA.tsx
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme';

interface Props {
  onPress: () => void;
}

export function ShareCTA({ onPress }: Props): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [S.cta, pressed && S.ctaPressed]}
      onPress={onPress}
      testID="share-cta"
      accessibilityRole="button"
      accessibilityLabel="Post an alert about what's happening around you"
    >
      <MCI name="map-marker-radius" size={20} color={colors.onPrimary} style={{ marginRight: 10 }} />
      <Text style={S.text}>Share what's happening around you</Text>
      <MCI name="chevron-right" size={20} color={colors.onPrimary} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const S = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { color: colors.onPrimary, fontSize: 15, fontWeight: '700', flexShrink: 1 },
});
