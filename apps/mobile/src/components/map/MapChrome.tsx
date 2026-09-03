// apps/mobile/src/components/map/MapChrome.tsx
// Top-of-map chrome: daily challenge, streak nudge, interactions entry,
// marketplace entry (IA-2).
// Owns stack visibility + absolute tops so cards never self-compute offsets.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { colors } from '@/theme';

import {
  INTERACTION_BADGE_SIZE,
  mapBadgeTop,
  mapChallengeTop,
  mapNudgeTop,
} from './mapChromeLayout';

interface Props {
  /** Entity bottom sheet open → hide challenge/nudge, lift badge. */
  sheetOpen: boolean;
  interactionUnread: number;
  onPressInteractions: () => void;
  /** Browse local marketplace (IA-2). */
  onPressMarketplace?: () => void;
}

export function MapChrome({
  sheetOpen,
  interactionUnread,
  onPressInteractions,
  onPressMarketplace,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const challengeTop = mapChallengeTop(insets.top);
  const nudgeTop = mapNudgeTop(insets.top);
  const badgeTop = mapBadgeTop(insets.top, sheetOpen);

  return (
    <>
      {!sheetOpen ? <DailyChallengeCard top={challengeTop} /> : null}
      {!sheetOpen ? <NudgeBanner top={nudgeTop} /> : null}

      {onPressMarketplace ? (
        <TouchableOpacity
          style={[styles.marketBadge, { top: badgeTop }]}
          onPress={onPressMarketplace}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Marketplace"
        >
          <Text style={styles.marketBadgeIcon}>🏪</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.interactionBadge, { top: badgeTop }]}
        onPress={onPressInteractions}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          interactionUnread > 0
            ? `Interactions, ${interactionUnread} unread`
            : 'Interactions'
        }
      >
        <Text style={styles.interactionBadgeIcon}>👋</Text>
        {interactionUnread > 0 ? (
          <View style={styles.interactionBadgeDot}>
            <Text style={styles.interactionBadgeCount}>
              {interactionUnread > 9 ? '9+' : interactionUnread}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  marketBadge: {
    position: 'absolute',
    right: 16 + INTERACTION_BADGE_SIZE + 10,
    width: INTERACTION_BADGE_SIZE,
    height: INTERACTION_BADGE_SIZE,
    borderRadius: INTERACTION_BADGE_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  marketBadgeIcon: { fontSize: 18 },
  interactionBadge: {
    position: 'absolute',
    right: 16,
    width: INTERACTION_BADGE_SIZE,
    height: INTERACTION_BADGE_SIZE,
    borderRadius: INTERACTION_BADGE_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  interactionBadgeIcon: { fontSize: 20 },
  interactionBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  interactionBadgeCount: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});
