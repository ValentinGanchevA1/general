/**
 * ProfileView shell (PR-A).
 * Presentational orchestrator for self + other profiles.
 * Sections and real layout land in PR-B/C/D — this file only
 * locks the props contract and a minimal placeholder tree.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

import type { ProfileViewProps } from './profileView.types';

export type { ProfileViewModel, ProfileViewActions, ProfileViewProps, ProfileFocusSection } from './profileView.types';

/**
 * Shared profile body. Screens own data hooks, navigation, and sheets.
 * Do not add fetch/side effects here.
 */
export function ProfileView({
  mode,
  profile,
  actions: _actions,
  primaryCta,
  focus,
  activePhotoIndex = 0,
  headerExtra,
  footerExtra,
  pendingFriendCount,
}: ProfileViewProps): React.JSX.Element {
  return (
    <View style={styles.root} testID={`profile-view-${mode}`}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {headerExtra}
        {/* PR-B+: hero, identity, CTAs, trust, stats, bio, tags, storyline, photos */}
        <View style={styles.placeholder} accessibilityLabel="Profile view shell">
          <Text style={styles.placeholderTitle}>
            {profile.displayName}
            {profile.age != null ? `, ${profile.age}` : ''}
          </Text>
          <Text style={styles.placeholderMeta}>
            mode={mode}
            {focus != null ? ` · focus=${focus}` : ''}
            {primaryCta != null ? ` · cta=${primaryCta.kind}` : ''}
          </Text>
          {profile.identityLine ? (
            <Text style={styles.placeholderLine}>{profile.identityLine}</Text>
          ) : null}
          {profile.hometownLine ? (
            <Text style={styles.placeholderLine}>{profile.hometownLine}</Text>
          ) : null}
          {mode === 'self' && pendingFriendCount != null && pendingFriendCount > 0 ? (
            <Text style={styles.placeholderMeta}>pending friends: {pendingFriendCount}</Text>
          ) : null}
          {profile.photoUrls.length > 0 ? (
            <Text style={styles.placeholderMeta}>
              photos: {profile.photoUrls.length} · active: {activePhotoIndex}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {footerExtra}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  placeholder: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: 4,
  },
  placeholderTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  placeholderMeta: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
  },
  placeholderLine: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
