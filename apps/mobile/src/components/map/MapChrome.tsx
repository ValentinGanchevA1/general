// Top-of-map chrome: challenge, streak nudge, interactions entry.
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
}

export function MapChrome({
  sheetOpen,
  interactionUnread,
  onPressInteractions,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const challengeTop = mapChallengeTop(insets.top);
  const nudgeTop = mapNudgeTop(insets.top);
  const badgeTop = mapBadgeTop(insets.top, sheetOpen);

  return (
    <>
      {!sheetOpen ? <DailyChallengeCard top={challengeTop} /> : null}
      {!sheetOpen ? <NudgeBanner top={nudgeTop} /> : null}

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
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});
