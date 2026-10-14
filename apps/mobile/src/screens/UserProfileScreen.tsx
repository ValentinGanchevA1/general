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
import { colors, spacing, useAppTheme } from '@/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

/**
 * Visitor profile screen — data + sheets + menu.
 * Layout lives in ProfileView mode="other" (PR-C).
 */
export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();
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

	const dismiss = (): void => {
		optionsRef.current?.dismiss();
	};

	const openMenu = (): void => {
		let items: ActionSheetItem[];
		if (blocked) {
			items = [
				{
					key: 'unblock',
					label: 'Unblock',
					onPress: () => {
						dismiss();
						void unblock();
					},
				},
			];
		} else {
			items = [
				{
					key: 'wave',
					label: 'Send wave',
					icon: 'hand-wave-outline',
					onPress: () => {
						dismiss();
						void sendWave();
					},
				},
				{
					key: 'message',
					label: 'Message',
					icon: 'message-outline',
					onPress: () => {
						dismiss();
						void openMessage();
					},
				},
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
			if (rel?.friendshipStatus === 'friends') {
				items.push({
					key: 'unfriend',
					label: 'Unfriend',
					icon: 'account-remove-outline',
					onPress: () => {
						dismiss();
						void unfriend();
					},
				});
			}
			items.push({
				key: 'block',
				label: 'Block',
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
			<View style={[styles.centered, { backgroundColor: themeColors.bg }]}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		);
	}

	if (!profile) return <View style={[styles.centered, { backgroundColor: themeColors.bg }]} />;

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
				footer={footer}
			/>
			<BottomSheetModal
				ref={optionsRef}
				index={0}
				snapPoints={optionsSnap}
				backdropComponent={renderBackdrop}
				enablePanDownToClose
				{...sheetChrome}
			>
				<BottomSheetView style={styles.sheetBody}>
					<ActionSheetList items={menuItems} />
				</BottomSheetView>
			</BottomSheetModal>
			<SendGiftSheet
				visible={giftSheetOpen}
				onClose={() => setGiftSheetOpen(false)}
				recipientId={userId}
				recipientName={profile.displayName}
			/>
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
		alignItems: 'center',
		justifyContent: 'flex-end',
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.borderStrong,
		backgroundColor: colors.bg,
	},
	footerBtn: {
		minHeight: 48,
		minWidth: 48,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
	},
	menuBtn: {
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	footerMenuOnly: { marginLeft: 'auto' },
	unblockBtn: {
		flex: 1,
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.dangerBorderSoft,
	},
	unblockBtnText: { color: colors.dangerMuted, fontWeight: '700', fontSize: 16 },
	sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
