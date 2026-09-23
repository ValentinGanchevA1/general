// Top-of-map chrome: challenge, streak/trust nudge, location recovery.
// Interactions inbox lives on Pulse — not on the map.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { useUserLocation } from '@/features/location/useUserLocation';
import { LocationPermissionBanner } from '@/features/location/LocationPermissionBanner';

import {
	mapChallengeTop,
	mapNudgeTop,
	type MapTopStackVisibility,
} from './mapChromeLayout';

interface Props {
	/** Entity bottom sheet open → hide challenge/nudge. */
	sheetOpen: boolean;
	/** Actual mount state of top cards (from MapScreen). */
	topStack: MapTopStackVisibility;
	/** Session dismiss for daily challenge (shared with layout math). */
	onDismissChallenge: () => void;
}

export function MapChrome({
	sheetOpen,
	topStack,
	onDismissChallenge,
}: Props): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const { permissionDenied, requestPermission } = useUserLocation();
	const challengeTop = mapChallengeTop(insets.top);
	const nudgeTop = mapNudgeTop(insets.top, topStack);

	return (
		<>
			{permissionDenied ? (
				<View style={[styles.locationWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
					<LocationPermissionBanner onRetry={() => void requestPermission()} />
				</View>
			) : null}

			{!sheetOpen && !permissionDenied && topStack.challengeVisible ? (
				<DailyChallengeCard top={challengeTop} onDismiss={onDismissChallenge} />
			) : null}
			{!sheetOpen && !permissionDenied && topStack.nudgeVisible ? (
				<NudgeBanner top={nudgeTop} />
			) : null}
		</>
	);
}

const styles = StyleSheet.create({
	locationWrap: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 30,
	},
});
