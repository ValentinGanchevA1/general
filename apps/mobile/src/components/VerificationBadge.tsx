// apps/mobile/src/components/VerificationBadge.tsx
//
// Compact verification glyph for other-user surfaces (chat header, profile
// card, map sheet, IdentityBlock).
//   • ID-verified  → primary "check-decagram"
//   • partial      → small ✓ chip (email/phone/selfie)
//   • none         → nothing rendered

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { VerificationLevel } from '@g88/shared';
import { colors } from '@/theme';

interface Props {
  verification: VerificationLevel;
  /** True when the user passed ID-document review — upgrades to the decagram. */
  idVerified?: boolean | undefined;
  /** Decagram icon size; the partial chip scales with it. */
  size?: number;
}

export function VerificationBadge({
  verification,
  idVerified = false,
  size = 16,
}: Props): React.JSX.Element | null {
  if (idVerified) {
    return (
      <Icon
        name="check-decagram"
        size={size}
        color={colors.primary}
        accessibilityLabel="ID verified"
      />
    );
  }
  if (verification !== 'none') {
    const dim = Math.max(0, size - 2);
    return (
      <View
        style={[
          styles.partial,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: colors.primary,
          },
        ]}
        accessibilityLabel="Verified"
      >
        <Text style={[styles.partialText, { fontSize: dim * 0.62 }]}>✓</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  partial: { alignItems: 'center', justifyContent: 'center' },
  partialText: { color: colors.onPrimary, fontWeight: '700' },
});
