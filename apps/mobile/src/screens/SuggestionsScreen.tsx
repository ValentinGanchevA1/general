import React, { useCallback, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { appAlert } from '@/ui/appAlert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ApiError, SuggestionCard } from '@g88/shared';

import type { SocialStackParamList } from '@/navigation/stacks';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { MutualPreviewStack } from '@/features/friends/MutualPreviewStack';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors, spacing, radius, fontSize } from '@/theme';
import { focusUserOnMap } from '@/navigation/focusUserOnMap';

type Nav = NativeStackNavigationProp<SocialStackParamList & RootStackParamList>;

function formatDistance(meters: number | null | undefined): string | null {
	if (meters == null || !Number.isFinite(meters)) return null;
	if (meters < 1000) return `${Math.max(1, Math.round(meters))} m away`;
	const km = meters / 1000;
	const digits = meters < 10_000 ? 1 : 0;
	return `${km.toFixed(digits)} km away`;
}

function reasonLabel(item: SuggestionCard): string {
	const n = item.mutualFriendsCount ?? 0;
	switch (item.reason) {
		case 'mutual_friends':
			return n === 1 ? '1 mutual friend' : `${n} mutual friends`;
		case 'recent_wave':
			return n > 0 ? `Recent wave · ${n} mutual` : 'Recent wave';
		case 'recent_chat':
			return n > 0 ? `Recent chat · ${n} mutual` : 'Recent chat';
		case 'nearby': {
			const d = formatDistance(item.distanceMeters);
			return d ? `Nearby · ${d}` : 'Nearby';
		}
		case 'shared_interests': {
			const c = item.sharedInterestsCount ?? 0;
			if (c <= 0) return 'Shared interests';
			const noun = c === 1 ? 'interest' : 'interests';
			return `${c} shared ${noun}`;
		}
		default:
			return 'Suggested for you';
	}
}

function isApiError(e: unknown): e is ApiError {
	return (
		typeof e === 'object' &&
		e !== null &&
		'code' in e &&
		typeof (e as { code: unknown }).code === 'string'
	);
}

export function SuggestionsScreen(): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const [items, setItems] = useState<SuggestionCard[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyIds, setBusyIds] = useState<string[]>([]);
	const [feedback, setFeedback] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await getJson<SuggestionCard[]>('/friends/suggestions?limit=20');
			setItems(Array.isArray(data) ? data : []);
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
					? (e as { message: string }).message
					: 'Could not load suggestions.';
			setError(msg);
		} finally {
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	const openProfile = useCallback(
		(userId: string) => {
			navigation.navigate('UserProfile', { userId });
		},
		[navigation],
	);

	const onViewOnMap = useCallback(
		(item: SuggestionCard) => {
			void focusUserOnMap(navigation, {
				userId: item.userId,
				displayName: item.displayName,
				avatarUrl: item.avatarUrl,
				...(item.verification != null ? { verification: item.verification } : {}),
			});
		},
		[navigation],
	);

	const setBusy = useCallback((userId: string, on: boolean) => {
		setBusyIds((prev) =>
			on ? (prev.includes(userId) ? prev : [...prev, userId]) : prev.filter((id) => id !== userId),
		);
	}, []);

	const markFollowing = useCallback((userId: string) => {
		setItems((prev) =>
			prev.map((c) => (c.userId === userId ? { ...c, isFollowing: true } : c)),
		);
	}, []);

	const markRequested = useCallback((userId: string) => {
		setItems((prev) =>
			prev.map((c) =>
				c.userId === userId ? { ...c, hasPendingOutgoing: true } : c,
			),
		);
	}, []);

	const removeCard = useCallback((userId: string) => {
		setItems((prev) => prev.filter((c) => c.userId !== userId));
	}, []);

	const onFollow = useCallback(
		async (userId: string) => {
			setBusy(userId, true);
			try {
				await postJson<{ userId: string }, { following: true }>('/friends/follow', { userId });
				markFollowing(userId);
			} catch (e) {
				const msg = isApiError(e) ? e.message : 'Try again.';
				appAlert('Could not follow', msg);
			} finally {
				setBusy(userId, false);
			}
		},
		[markFollowing, setBusy],
	);

	const onAddFriend = useCallback(
		async (userId: string) => {
			setBusy(userId, true);
			try {
				await postJson<{ userId: string }, { requestId: string }>('/friends/requests', {
					userId,
				});
				markRequested(userId);
			} catch (e) {
				if (isApiError(e)) {
					if (e.code === 'friends.request_pending') {
						markRequested(userId);
						return;
					}
					if (e.code === 'friends.already_friends') {
						removeCard(userId);
						return;
					}
					appAlert('Could not send request', e.message || 'Try again.');
					return;
				}
				appAlert('Could not send request', 'Try again.');
			} finally {
				setBusy(userId, false);
			}
		},
		[markRequested, removeCard, setBusy],
	);

	const onDismiss = useCallback(
		(item: SuggestionCard) => {
			appAlert(
				'Hide suggestion?',
				`Remove ${item.displayName} from suggestions.`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Snooze 7 days',
						onPress: () => {
							void (async () => {
								setBusy(item.userId, true);
								try {
									await postJson<{ snoozeDays: number }, { ok: true }>(
										`/friends/suggestions/${item.userId}/dismiss`,
										{ snoozeDays: 7 },
									);
									removeCard(item.userId);
									setFeedback('Hidden for 7 days');
									setTimeout(() => setFeedback(null), 2200);
								} catch (e) {
									appAlert('Could not hide', isApiError(e) ? e.message : 'Try again.');
								} finally {
									setBusy(item.userId, false);
								}
							})();
						},
					},
					{
						text: 'Dismiss',
						style: 'destructive',
						onPress: () => {
							void (async () => {
								setBusy(item.userId, true);
								try {
									await postJson<Record<string, never>, { ok: true }>(
										`/friends/suggestions/${item.userId}/dismiss`,
										{},
									);
									removeCard(item.userId);
									setFeedback('Removed from suggestions');
									setTimeout(() => setFeedback(null), 2200);
								} catch (e) {
									appAlert('Could not hide', isApiError(e) ? e.message : 'Try again.');
								} finally {
									setBusy(item.userId, false);
								}
							})();
						},
					},
				],
			);
		},
		[removeCard, setBusy],
	);

	const renderItem = useCallback(
		({ item }: { item: SuggestionCard }) => {
			const busy = busyIds.includes(item.userId);
			const label = reasonLabel(item);
			const showMutualLink =
				item.mutualFriendsCount > 0 &&
				(item.reason === 'mutual_friends' || item.reason === 'recent_wave' || item.reason === 'recent_chat');
			const distLine =
				item.reason !== 'nearby' ? formatDistance(item.distanceMeters) : null;

			return (
				<View style={S.card}>
					<TouchableOpacity
						style={S.cardMain}
						onPress={() => openProfile(item.userId)}
						accessibilityRole="button"
						accessibilityLabel={`Open profile for ${item.displayName}`}
					>
						<Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
						<View style={S.cardMeta}>
							<Text style={S.name} numberOfLines={1}>
								{item.displayName}
							</Text>
							<View style={S.reasonRow}>
								{item.mutualPreview && item.mutualPreview.length > 0 ? (
									<MutualPreviewStack faces={item.mutualPreview} />
								) : null}
								{showMutualLink ? (
									<TouchableOpacity
										onPress={() =>
											navigation.navigate('MutualFriends', {
												peerUserId: item.userId,
												peerName: item.displayName,
											})
										}
										accessibilityRole="button"
										accessibilityLabel={label}
										hitSlop={6}
									>
										<Text style={S.reasonLink}>{label}</Text>
									</TouchableOpacity>
								) : (
									<Text style={S.reason}>{label}</Text>
								)}
							</View>
							{distLine ? <Text style={S.dist}>{distLine}</Text> : null}
						</View>
					</TouchableOpacity>
					<View style={S.actions}>
						<TouchableOpacity
							style={S.iconBtn}
							onPress={() => onViewOnMap(item)}
							accessibilityRole="button"
							accessibilityLabel={`View ${item.displayName} on map`}
						>
							<Icon name="map-marker-outline" size={20} color={colors.textMuted} />
						</TouchableOpacity>
						<TouchableOpacity
							style={S.iconBtn}
							onPress={() => onDismiss(item)}
							disabled={busy}
							accessibilityRole="button"
							accessibilityLabel={`Hide ${item.displayName}`}
						>
							<Icon name="close" size={20} color={colors.textFaint} />
						</TouchableOpacity>
						{item.hasPendingOutgoing ? (
							<Text style={S.sent}>Sent</Text>
						) : item.isFollowing ? (
							<TouchableOpacity
								style={S.secondaryBtn}
								onPress={() => void onAddFriend(item.userId)}
								disabled={busy}
								accessibilityRole="button"
								accessibilityLabel={`Add ${item.displayName} as friend`}
							>
								{busy ? (
									<ActivityIndicator size="small" color={colors.primary} />
								) : (
									<Text style={S.secondaryText}>Add friend</Text>
								)}
							</TouchableOpacity>
						) : (
							<TouchableOpacity
								style={S.primaryBtn}
								onPress={() => void onFollow(item.userId)}
								disabled={busy}
								accessibilityRole="button"
								accessibilityLabel={`Follow ${item.displayName}`}
							>
								{busy ? (
									<ActivityIndicator size="small" color={colors.onPrimary} />
								) : (
									<Text style={S.primaryText}>Follow</Text>
								)}
							</TouchableOpacity>
						)}
					</View>
				</View>
			);
		},
		[busyIds, navigation, onAddFriend, onDismiss, onFollow, onViewOnMap, openProfile],
	);

	return (
		<View style={S.root}>
			<ScreenHeader title="Suggestions" />
			{feedback ? (
				<Text style={S.feedback} accessibilityLiveRegion="polite">
					{feedback}
				</Text>
			) : null}

			{loading && items.length === 0 ? (
				<View style={S.list}>
					<SkeletonListRow />
					<SkeletonListRow />
					<SkeletonListRow />
					<SkeletonListRow />
					<SkeletonListRow />
				</View>
			) : error && items.length === 0 ? (
				<EmptyState
					icon="alert-circle-outline"
					title="Could not load"
					body={error}
					actionLabel="Retry"
					onAction={() => void load()}
				/>
			) : items.length === 0 ? (
				<EmptyState
					icon="account-search-outline"
					title="No suggestions right now"
					body="Wave, chat, or meet people nearby — then check back for people you may know."
				/>
			) : (
				<FlatList
					data={items}
					keyExtractor={(i) => i.userId}
					renderItem={renderItem}
					contentContainerStyle={S.list}
					refreshControl={
						<RefreshControl
							refreshing={loading}
							onRefresh={() => void load()}
							tintColor={colors.primary}
						/>
					}
				/>
			)}
		</View>
	);
}

const S = StyleSheet.create({
	feedback: {
		color: colors.textMuted,
		fontSize: 13,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.sm,
	},
	root: { flex: 1, backgroundColor: colors.bg },
	list: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.surfaceRaised,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.md,
		gap: spacing.sm,
	},
	cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
	cardMeta: { flex: 1, minWidth: 0 },
	name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
	reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
	reason: { color: colors.textMuted, fontSize: fontSize.sm },
	reasonLink: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
	dist: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	iconBtn: { padding: 6 },
	primaryBtn: {
		backgroundColor: colors.action,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: radius.pill,
		minWidth: 72,
		alignItems: 'center',
	},
	primaryText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
	secondaryBtn: {
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: radius.pill,
		minWidth: 88,
		alignItems: 'center',
	},
	secondaryText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
	sent: { color: colors.textMuted, fontSize: 12, fontWeight: '600', paddingHorizontal: 8 },
});
