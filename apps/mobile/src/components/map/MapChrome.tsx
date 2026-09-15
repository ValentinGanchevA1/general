// Top-of-map chrome: challenge, streak/trust nudge, interactions entry + location recovery.
// Owns stack visibility + absolute tops so cards never self-compute offsets.
// Tops collapse when challenge/nudge are hidden (mapChromeLayout visibility flags).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { useUserLocation } from '@/features/location/useUserLocation';
import { LocationPermissionBanner } from '@/features/location/LocationPermissionBanner';
import { colors } from '@/theme';

import {
	INTERACTION_BADGE_SIZE,
	mapBadgeTop,
	mapChallengeTop,
	mapNudgeTop,
	type MapTopStackVisibility,
} from './mapChromeLayout';

interface Props {
	/** Entity bottom sheet open → hide challenge/nudge, lift badge. */
	sheetOpen: boolean;
	interactionUnread: number;
	onPressInteractions: () => void;
	/** Actual mount state of top cards (from MapScreen). */
	topStack: MapTopStackVisibility;
	/** Session dismiss for daily challenge (shared with layout math). */
	onDismissChallenge: () => void;
}

export function MapChrome({
	sheetOpen,
	interactionUnread,
	onPressInteractions,
	topStack,
	onDismissChallenge,
}: Props): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const { permissionDenied, requestPermission } = useUserLocation();
	const challengeTop = mapChallengeTop(insets.top);
	const nudgeTop = mapNudgeTop(insets.top, topStack);
	const badgeTop = mapBadgeTop(insets.top, sheetOpen, topStack);

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
	locationWrap: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 30,
	},
	interactionBadge: {
		position: 'absolute',
		right: 16,
		width: INTERACTION_BADGE_SIZE,
		height: INTERACTION_BADGE_SIZE,
		borderRadius: INTERACTION_BADGE_SIZE / 2,
		backgroundColor: 'rgba(18,18,31,0.94)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 22,
	},
	interactionBadgeIcon: {
		fontSize: 20,
	},
	interactionBadgeDot: {
		position: 'absolute',
		top: -2,
		right: -2,
		minWidth: 18,
		height: 18,
		borderRadius: 9,
		paddingHorizontal: 4,
		backgroundColor: colors.danger,
		alignItems: 'center',
		justifyContent: 'center',
	},
	interactionBadgeCount: {
		color: colors.onPrimary,
		fontSize: 10,
		fontWeight: '700',
	},
});
