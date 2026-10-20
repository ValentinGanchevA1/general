// Map chrome: concept-board category chips only.
// Search and duplicate create controls are intentionally absent from MapScreen;
// create remains the centered bottom-tab action and advanced filters live in More.

import React, { useCallback, useState } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DiscoveryRankBy, EntityKind, ListingMode } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, fontSize, radius, spacing, useAppTheme } from '@/theme';

import { COMBINED_FILTER_ROW_HEIGHT } from './mapChromeLayout';

export type ListingModeFilterValue = 'all' | ListingMode;

/** Cold-start layers — People only; Events/Listings are intentional toggles. */
export const DEFAULT_MAP_LAYERS: EntityKind[] = ['user'];

type LayerOption = {
	id: EntityKind;
	label: string;
	a11y: string;
	icon: string;
};

const LAYER_OPTIONS: LayerOption[] = [
	{ id: 'user', label: 'People', a11y: 'People layer', icon: 'account-group-outline' },
	{ id: 'event', label: 'Events', a11y: 'Events layer', icon: 'calendar-month-outline' },
	{ id: 'listing', label: 'Listings', a11y: 'Listings layer', icon: 'storefront-outline' },
];

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All listings' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

const SORT_OPTIONS: Array<{ id: DiscoveryRankBy; label: string }> = [
	{ id: 'relevance', label: 'Relevant' },
	{ id: 'distance', label: 'Nearest' },
	{ id: 'newest', label: 'Newest' },
];

export interface MapFilterRowProps {
	/** Retained for API compatibility; search is intentionally not rendered on Map. */
	value: string;
	/** Retained for API compatibility; search is intentionally not rendered on Map. */
	onChangeText: (text: string) => void;
	/** Active discovery layers (at least one). */
	layers: EntityKind[];
	onLayersChange: (next: EntityKind[]) => void;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	datingOnly: boolean;
	onDatingOnlyChange: (next: boolean) => void;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
	/** Retained for API compatibility; create is owned by the center tab. */
	onPressCreate: () => void;
	top: number;
	placeholder?: string;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapFilterRow({
	layers,
	onLayersChange,
	listingMode,
	onListingModeChange,
	friendsOnly,
	onFriendsOnlyChange,
	datingOnly,
	onDatingOnlyChange,
	rankBy,
	onRankByChange,
	top,
}: MapFilterRowProps): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const { colors: c } = useAppTheme();
	const showPeople = layers.includes('user');
	const showListings = layers.includes('listing');
	const [moreOpen, setMoreOpen] = useState(false);
	const moreActive =
		friendsOnly ||
		datingOnly ||
		rankBy !== 'relevance' ||
		(showListings && listingMode !== 'all');

	const toggleLayer = useCallback(
		(id: EntityKind) => {
			if (layers.includes(id)) {
				if (layers.length <= 1) return;
				onLayersChange(layers.filter((kind) => kind !== id));
				return;
			}
			onLayersChange([...layers, id]);
		},
		[layers, onLayersChange],
	);

	const openAlerts = useCallback((): void => {
		navigation.navigate('AlertComposer', { presetCategory: 'general' });
	}, [navigation]);

	const layerTone = useCallback(
		(id: EntityKind): string => {
			if (id === 'event') return c.accent;
			if (id === 'listing') return c.warning;
			return c.primary;
		},
		[c.accent, c.primary, c.warning],
	);

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.row}
			>
				{LAYER_OPTIONS.map((option) => {
					const active = layers.includes(option.id);
					const tone = layerTone(option.id);
					return (
						<Pressable
							key={option.id}
							onPress={() => toggleLayer(option.id)}
							style={[
								styles.chip,
								{
									backgroundColor: active ? c.primarySoft : 'rgba(10,10,15,0.88)',
									borderColor: active ? tone : c.borderStrong,
								},
							]}
							accessibilityRole="button"
							accessibilityState={{ selected: active }}
							accessibilityLabel={option.a11y}
						>
							<Icon name={option.icon} size={17} color={tone} />
							<Text style={[styles.chipText, { color: active ? tone : c.textSecondary }]}>
								{option.label}
							</Text>
						</Pressable>
					);
				})}

				<Pressable
					onPress={openAlerts}
					style={[
						styles.chip,
						{
							backgroundColor: 'rgba(10,10,15,0.88)',
							borderColor: c.borderStrong,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="Create a local alert"
				>
					<Icon name="bell-outline" size={17} color={c.dangerMuted} />
					<Text style={[styles.chipText, { color: c.textSecondary }]}>Alerts</Text>
				</Pressable>

				<Pressable
					onPress={() => setMoreOpen(true)}
					style={[
						styles.moreChip,
						{
							backgroundColor: 'rgba(10,10,15,0.88)',
							borderColor: moreActive ? c.primary : c.borderStrong,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="More map filters"
				>
					<Icon name="tune-variant" size={17} color={moreActive ? c.primary : c.textMuted} />
				</Pressable>
			</ScrollView>

			<Modal
				visible={moreOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setMoreOpen(false)}
			>
				<Pressable
					style={styles.modalBackdrop}
					onPress={() => setMoreOpen(false)}
					accessibilityRole="button"
					accessibilityLabel="Dismiss filters"
				>
					<Pressable
						style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}
						onPress={(event) => event.stopPropagation()}
					>
						<Text style={[styles.modalTitle, { color: c.textPrimary }]}>Map filters</Text>

						<Text style={[styles.modalSection, { color: c.textMuted }]}>Sort</Text>
						{SORT_OPTIONS.map((option) => {
							const active = rankBy === option.id;
							return (
								<Pressable
									key={option.id}
									onPress={() => onRankByChange(option.id)}
									style={[
										styles.modalRow,
										active && { backgroundColor: c.primarySoft, borderColor: c.primaryBorder },
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
								>
									<Text style={[styles.modalRowText, { color: active ? c.primary : c.textPrimary }]}>
										{option.label}
									</Text>
									{active ? <Icon name="check" size={18} color={c.primary} /> : null}
								</Pressable>
							);
						})}

						{showPeople ? (
							<>
								<Text style={[styles.modalSection, { color: c.textMuted }]}>People</Text>
								<Pressable
									onPress={() => {
										onFriendsOnlyChange(!friendsOnly);
										if (!friendsOnly) onDatingOnlyChange(false);
									}}
									style={[
										styles.modalRow,
										friendsOnly && { backgroundColor: c.primarySoft, borderColor: c.entityFriend },
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: friendsOnly }}
								>
									<Text style={[styles.modalRowText, { color: friendsOnly ? c.entityFriend : c.textPrimary }]}>
										Friends only
									</Text>
									{friendsOnly ? <Icon name="check" size={18} color={c.entityFriend} /> : null}
								</Pressable>

								<Pressable
									onPress={() => {
										onDatingOnlyChange(!datingOnly);
										if (!datingOnly) onFriendsOnlyChange(false);
									}}
									style={[
										styles.modalRow,
										datingOnly && { backgroundColor: c.primarySoft, borderColor: c.entityUser },
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: datingOnly }}
								>
									<Text style={[styles.modalRowText, { color: datingOnly ? c.entityUser : c.textPrimary }]}>
										Dating
									</Text>
									{datingOnly ? <Icon name="check" size={18} color={c.entityUser} /> : null}
								</Pressable>
							</>
						) : null}

						{showListings ? (
							<>
								<Text style={[styles.modalSection, { color: c.textMuted }]}>Listings</Text>
								{LISTING_OPTIONS.map((option) => {
									const active = listingMode === option.id;
									return (
										<Pressable
											key={option.id}
											onPress={() => onListingModeChange(option.id)}
											style={[
												styles.modalRow,
												active && { backgroundColor: c.primarySoft, borderColor: c.warning },
											]}
											accessibilityRole="button"
											accessibilityState={{ selected: active }}
										>
											<Text style={[styles.modalRowText, { color: active ? c.warning : c.textPrimary }]}>
												{option.label}
											</Text>
											{active ? <Icon name="check" size={18} color={c.warning} /> : null}
										</Pressable>
									);
								})}
							</>
						) : null}

						<Pressable
							style={[styles.modalDone, { backgroundColor: c.primary }]}
							onPress={() => setMoreOpen(false)}
							accessibilityRole="button"
							accessibilityLabel="Done"
						>
							<Text style={[styles.modalDoneText, { color: c.onPrimary }]}>Done</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: 0,
		right: 0,
		zIndex: 20,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		gap: 10,
		minHeight: COMBINED_FILTER_ROW_HEIGHT,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 7,
		paddingHorizontal: 14,
		height: 38,
		borderRadius: radius.pill,
		borderWidth: 1,
	},
	chipText: {
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	moreChip: {
		width: 38,
		height: 38,
		borderRadius: 19,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.62)',
		justifyContent: 'center',
		padding: spacing.xl,
	},
	modalCard: {
		borderRadius: radius.xl,
		borderWidth: 1,
		padding: spacing.lg,
	},
	modalTitle: {
		fontSize: fontSize.lg,
		fontWeight: '800',
		marginBottom: spacing.sm,
	},
	modalSection: {
		fontSize: fontSize.xs,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginTop: spacing.md,
		marginBottom: 6,
	},
	modalRow: {
		minHeight: 44,
		paddingHorizontal: 12,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 6,
	},
	modalRowText: {
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	modalDone: {
		marginTop: spacing.lg,
		minHeight: 44,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalDoneText: {
		fontSize: fontSize.sm,
		fontWeight: '800',
	},
});
