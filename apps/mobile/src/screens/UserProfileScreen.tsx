import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appAlert } from '@/ui/appAlert';
import {
	BottomSheetModal,
	BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { ProfileView } from '@/components/Profile/ProfileView';
import {
	ActionSheetList,
	sheetChrome,
	useSheetBackdrop,
	type ActionSheetItem,
} from '@/components/sheets';
import { useUserProfileScreenData } from '@/features/profile/useUserProfileScreenData';
import {
	friendLabelFromRel,
	mapPublicToViewModel,
} from '@/features/profile/mapToProfileViewModel';
import { resolveUserPrimaryCta } from '@/features/social/resolveUserPrimaryCta';
import { colors, spacing } from '@/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

/**
 * Visitor profile screen — data + sheets + menu.
 * Layout lives in ProfileView mode="other" (PR-C).
 */
export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
	const { userId, focus } = route.params;
	const insets = useSafeAreaInsets();
	const {
		profile,
		rel,
		loading,
		waving,
		messaging,
		giftSheetOpen,
		setGiftSheetOpen,
		blocking,
		followBusy,
		friendBusy,
		blocked,
		canMessage,
		sendWave,
		openMessage,
		viewOnMap,
		unblock,
		confirmBlock,
		onFollowToggle,
		onFriendAction,
		openMutualFriends,
		unfriend,
	} = useUserProfileScreenData(userId, navigation);

	const optionsRef = useRef<BottomSheetModal>(null);
	const optionsSnap = useMemo(() => ['32%', '42%'], []);
	const renderBackdrop = useSheetBackdrop(0.55);
	const [menuItems, setMenuItems] = useState<ActionSheetItem[]>([]);

	// Deep-link focus=mutual → navigate to MutualFriends (same as pre-PR-C).
	useEffect(() => {
		if (!profile || focus !== 'mutual') return;
		if (!rel || rel.mutualFriendsCount < 1) return;
		navigation.navigate('MutualFriends', {
			peerUserId: userId,
			...(profile.displayName ? { peerName: profile.displayName } : {}),
		});
	}, [profile, focus, rel, navigation, userId]);

	const openMenu = (): void => {
		const name = profile?.displayName ?? 'this user';
		const dismiss = (): void => {
			optionsRef.current?.dismiss();
		};

		let items: ActionSheetItem[];
		if (blocked) {
			items = [
				{
					key: 'unblock',
					label: 'Unblock',
					icon: 'account-check-outline',
					onPress: () => {
						dismiss();
						void unblock();
					},
				},
			];
		} else {
			items = [
				{
					key: 'gift',
					label: 'Send gift',
					icon: 'gift-outline',
					onPress: () => {
						dismiss();
						setGiftSheetOpen(true);
					},
				},
			];
			if (rel?.state === 'friends') {
				items.push({
					key: 'unfriend',
					label: 'Unfriend',
					icon: 'account-remove-outline',
					destructive: true,
					onPress: () => {
						dismiss();
						appAlert('Unfriend', `Remove ${name} from friends?`, [
							{ text: 'Cancel', style: 'cancel' },
							{
								text: 'Unfriend',
								style: 'destructive',
								onPress: () => void unfriend(),
							},
						]);
					},
				});
			}
			items.push({
				key: 'report',
				label: 'Report',
				icon: 'flag-outline',
				onPress: () => {
					dismiss();
					appAlert(
						'Report submitted',
						'Thanks — our team will review this profile. For serious harm use local emergency services.',
					);
				},
			});
			items.push({
				key: 'block',
				label: 'Block user',
				icon: 'block-helper',
				destructive: true,
				onPress: () => {
					dismiss();
					confirmBlock();
				},
			});
		}

		setMenuItems(items);
		optionsRef.current?.present();
	};

	if (loading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		);
	}

	if (!profile) return <View style={styles.centered} />;

	const friendLabel = friendLabelFromRel(rel);
	const viewModel = mapPublicToViewModel(profile, {
		rel,
		friendLabel,
		blocked,
	});

	const primaryCta = resolveUserPrimaryCta({
		relationshipKnown: true,
		blocked,
		canMessage: canMessage ?? 'none',
		matched: profile.relationship?.matched === true,
		waveAvailable: true,
	});

	const footer = (
		<View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
			{blocked ? (
				<TouchableOpacity
					style={styles.unblockBtn}
					onPress={() => void unblock()}
					disabled={blocking}
				>
					<Text style={styles.unblockBtnText}>Unblock</Text>
				</TouchableOpacity>
			) : (
				<TouchableOpacity
					style={[styles.footerBtn, styles.menuBtn, styles.footerMenuOnly]}
					onPress={openMenu}
					accessibilityRole="button"
					accessibilityLabel="More options"
				>
					<Icon name="dots-horizontal" size={22} color={colors.textPrimary} />
				</TouchableOpacity>
			)}
		</View>
	);

	return (
		<>
			<ProfileView
				mode="other"
				profile={viewModel}
				primaryCta={primaryCta}
				waving={waving}
				messaging={messaging}
				followBusy={followBusy}
				friendBusy={friendBusy}
				{...(focus ? { focus } : {})}
				actions={{
					onPressViewOnMap: viewOnMap,
					onPressMutual: openMutualFriends,
					onPrimaryCta: () => {
						if (primaryCta.kind === 'message') void openMessage();
						else if (primaryCta.kind === 'wave') void sendWave();
					},
					onFollowToggle,
					onFriendAction,
					onPressMenu: openMenu,
				}}
				footerExtra={footer}
			/>

			<SendGiftSheet
				visible={giftSheetOpen}
				onClose={() => setGiftSheetOpen(false)}
				recipientId={userId}
				recipientName={profile.displayName}
			/>

			<BottomSheetModal
				ref={optionsRef}
				snapPoints={optionsSnap}
				enablePanDownToClose
				backdropComponent={renderBackdrop}
				backgroundStyle={sheetChrome.background}
				handleIndicatorStyle={sheetChrome.handle}
			>
				<BottomSheetView style={styles.sheetBody}>
					<ActionSheetList items={menuItems} />
				</BottomSheetView>
			</BottomSheetModal>
		</>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg,
	},
	footer: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: spacing.xl,
		paddingTop: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.borderStrong,
		backgroundColor: colors.bg,
	},
	footerBtn: {
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 50,
	},
	menuBtn: {
		width: 56,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	footerMenuOnly: {
		marginLeft: 'auto',
		flex: 0,
	},
	unblockBtn: {
		flex: 1,
		borderRadius: 14,
		padding: 16,
		alignItems: 'center',
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.dangerBorderSoft,
	},
	unblockBtnText: { color: colors.dangerMuted, fontWeight: '700', fontSize: 16 },
	sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
