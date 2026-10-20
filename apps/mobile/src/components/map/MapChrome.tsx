// Top-of-map supporting chrome: weather/clock, challenge, nudge + location recovery.
// The primary filter/recenter row is owned by MapScreen and always stays above this stack.
// Interactions is owned by the canonical bottom tab, so no duplicate floating entry lives here.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { useUserLocation } from '@/features/location/useUserLocation';
import { LocationPermissionBanner } from '@/features/location/LocationPermissionBanner';
import { WeatherClockWidget } from '@/features/weather/WeatherClockWidget';

import {
	MAP_CHROME_H_INSET,
	mapChallengeTop,
	mapNudgeTop,
	mapWeatherTop,
	type MapTopStackVisibility,
} from './mapChromeLayout';

interface Props {
	/** Entity bottom sheet open → hide challenge/nudge/weather. */
	sheetOpen: boolean;
	/** Retained for caller compatibility; Interactions is bottom-tab only. */
	interactionUnread: number;
	/** Retained for caller compatibility; Interactions is bottom-tab only. */
	onPressInteractions: () => void;
	/** Actual mount state of supporting cards (from MapScreen). */
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
	const { coords, permissionDenied, requestPermission } = useUserLocation();
	const weatherTop = mapWeatherTop(insets.top, sheetOpen, topStack);
	const challengeTop = mapChallengeTop(insets.top);
	const nudgeTop = mapNudgeTop(insets.top, topStack);

	return (
		<>
			{permissionDenied ? (
				<View style={[styles.locationWrap, { top: weatherTop }]} pointerEvents="box-none">
					<LocationPermissionBanner onRetry={() => void requestPermission()} />
				</View>
			) : null}

			{!sheetOpen && !permissionDenied && coords != null ? (
				<WeatherClockWidget
					coords={coords}
					top={weatherTop}
					right={MAP_CHROME_H_INSET}
				/>
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
