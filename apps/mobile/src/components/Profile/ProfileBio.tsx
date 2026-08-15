import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

interface Props {
  bio: string;
  /** Public profile shows an "About" label; self profile is plain text. */
  showTitle?: boolean;
  /** When false, skip horizontal padding (parent already pads). Default true. */
  padded?: boolean;
}

/** Profile bio block — shared by self ProfileScreen and public UserProfileScreen. */
export function ProfileBio({
  bio,
  showTitle = false,
  padded = true,
}: Props): React.JSX.Element {
  return (
    <View style={[styles.section, padded && styles.padded]}>
      {showTitle ? <Text style={styles.title}>About</Text> : null}
      <Text style={styles.bio}>{bio}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md },
  padded: { paddingHorizontal: spacing.xl },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  bio: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
});
