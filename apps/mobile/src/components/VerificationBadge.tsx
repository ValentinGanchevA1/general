// apps/mobile/src/components/VerificationBadge.tsx
//
// P3.4 — one consistent verification glyph across the app's *other-user*
// surfaces (chat header, profile card, map sheet). Two tiers:
//   • ID-verified  → blue "check-decagram" (the strong trust signal)
//   • partial      → small ✓ chip (email/phone/selfie on the ladder)
//   • none         → nothing rendered
// Self-profile keeps its richer badge row in ProfileScreen; this is the
// compact read-only badge for everyone else.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { VerificationLevel } from '@g88/shared';

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
    return <Icon name="check-decagram" size={size} color="#00d4ff" />;
  }
  if (verification !== 'none') {
    const dim = size - 2;
    return (
      <View
        style={[styles.partial, { width: dim, height: dim, borderRadius: dim / 2 }]}
        accessibilityLabel="Verified"
      >
        <Text style={[styles.partialText, { fontSize: dim * 0.62 }]}>✓</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  partial: { backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center' },
  partialText: { color: '#000', fontWeight: '700' },
});
