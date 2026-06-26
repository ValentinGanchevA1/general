// apps/mobile/src/components/map/MapTopStack.tsx
//
// Single managed slot for the map's top overlays (Phase-2 UX pass). Replaces the
// three independently-absolute banners (TrendingFilterBar / DailyChallengeCard /
// NudgeBanner) that each hardcoded a `top` offset assuming the others were
// present — which left gaps when any one self-hid and stacked ~210px of chrome
// over the map when all three showed.
//
// Here a single absolutely-positioned, safe-area-aware column lays the children
// out with a flex `gap`, so hidden children simply collapse with no gap. Promos
// are capped to ONE (verification/streak nudge takes priority over the daily
// challenge) so the map never carries more than the filter row + one promo.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';
import { TrendingFilterBar } from '@/features/discovery/TrendingFilterBar';
import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { useNudges } from '@/features/nudges/useNudges';

interface Props {
  topics: string[];
  activeTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
}

export function MapTopStack({ topics, activeTopic, onSelectTopic }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { nudge, dismiss } = useNudges();

  return (
    <View style={[styles.stack, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <TrendingFilterBar topics={topics} activeTopic={activeTopic} onSelect={onSelectTopic} />
      {/* One promo at a time: a trust/streak nudge outranks the daily challenge. */}
      {nudge ? (
        <NudgeBanner nudge={nudge} onDismiss={dismiss} />
      ) : (
        <DailyChallengeCard />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    gap: spacing.sm,
  },
});
