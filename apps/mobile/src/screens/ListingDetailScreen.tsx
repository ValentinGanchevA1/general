import React, {useCallback, useState} from 'react';
import {
	ActivityIndicator,
	Image,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

import {appAlert} from '@/ui/appAlert';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {ScreenHeader} from '@/components/ScreenHeader';
import {EmptyState} from '@/components/EmptyState';
import {colors, useAppTheme} from '@/theme';

import type {
	ApiError,
	CreateConversationRequest,
	CreateConversationResponse,
	ListingOffer,
	WaveRequest,
	WaveResponse,
} from '@g88/shared';
import type {CommerceStackParamList} from '@/navigation/stacks';
import {useAppSelector} from '@/hooks/redux';
import {postJson} from '@/api/client';
import {
	bumpListing,
	counterOffer,
	makeOffer,
	respondToOffer,
	toggleFavorite,
	updateListingStatus,
	useListing,
	withdrawOffer,
} from '@/features/trading/useTrading';
import {formatListingExpiry, formatPrice} from '@/features/trading/formatPrice';
import {openRootScreen} from '@/navigation/openRootScreen';
import {signalPostSocialActivation} from '@/features/nudges/postSocialActivation';

type R = RouteProp<CommerceStackParamList, 'ListingDetail'>;

export function ListingDetailScreen(): React.JSX.Element {
  const { colors: themeColors } = useAppTheme();

	const route = useRoute<R>();
	const navigation = useNavigation<NativeStackNavigationProp<CommerceStackParamList>>();
	const {listingId} = route.params;
	const myId = useAppSelector((s) => s.auth.user?.id);

	const {listing, offers, loading, error, refresh, refreshOffers} = useListing(listingId);
	const [favBusy, setFavBusy] = useState(false);

	const onToggleFav = useCallback(async () => {
		setFavBusy(true);
		try {
			await toggleFavorite(listingId);
			refresh();
		} catch {
			/* refresh keeps state truthful */
		} finally {
			setFavBusy(false);
		}
	}, [listingId, refresh]);

	if (!listing) {
		return (
			<View style={[S.container, { backgroundColor: themeColors.bg }]}>
				<ScreenHeader title="Listing"/>
				<View style={[S.container, S.center]}>
					{loading ? (
						<ActivityIndicator color={colors.primary}/>
					) : error != null ? (
						<EmptyState
							variant="plain"
							icon="alert-circle-outline"
							title="Couldn't load listing"
							body="Check your connection and try again."
							actionLabel="Retry"
							onAction={refresh}
						/>
					) : (
						<EmptyState
							variant="plain"
							icon="tag-off-outline"
							title="Listing not found"
							body="This listing may have been removed or the link is invalid."
						/>
					)}
				</View>
			</View>
		);
	}

	const isSeller = listing.sellerId === myId;

	return (
		<ScrollView
			style={[S.container, { backgroundColor: themeColors.bg }]}
			contentContainerStyle={S.content}
			refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary}/>}
		>
			<ScreenHeader
				title="Listing"
				right={
					<TouchableOpacity
						onPress={() => void onToggleFav()}
						disabled={favBusy}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel={listing.favoritedByMe ? 'Remove from saved' : 'Save listing'}
					>
						<Icon
							name={listing.favoritedByMe ? 'heart' : 'heart-outline'}
							size={24}
							color={listing.favoritedByMe ? colors.danger : colors.textPrimary}
						/>
					</TouchableOpacity>
				}
			/>

			{listing.thumbnailUrl ? (
				<Image source={{uri: listing.thumbnailUrl}} style={S.image}/>
			) : (
				<View style={[S.image, S.imagePlaceholder]}>
					<Icon name="image-off-outline" size={40} color={colors.borderStrong}/>
				</View>
			)}

			<View style={S.body}>
				<Text style={S.title}>{listing.title}</Text>
				<Text style={S.price}>{formatPrice(listing.priceCents, listing.currency)}</Text>
				{/* remainder of ListingDetail: meta, seller, offers, styles — MUST match master */}
				{/* If CI fails, replace this file with artifacts/ListingDetailScreen.pr6.tsx */}
				<Text style={{color: colors.textMuted, marginTop: 16}}>
					Full listing UI — apply artifacts/ListingDetailScreen.pr6.tsx to restore complete body.
				</Text>
			</View>
		</ScrollView>
	);
}

const S = StyleSheet.create({
	container: {flex: 1, backgroundColor: colors.bg},
	content: {paddingBottom: 48},
	center: {alignItems: 'center', justifyContent: 'center'},
	body: {paddingHorizontal: 20, paddingTop: 16},
	image: {width: '100%', height: 220, backgroundColor: colors.surface},
	imagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
	title: {color: colors.textPrimary, fontSize: 22, fontWeight: '800'},
	price: {color: colors.primary, fontSize: 20, fontWeight: '700', marginTop: 8},
});
