// apps/mobile/src/screens/ListingDetailScreen.tsx
//
// P3.7 listing detail. Buyer: favorite, make/withdraw an offer, wave the seller.
// Seller: review offers (accept / counter / decline) and mark sold/withdrawn.

import React, { useCallback, useState } from 'react';
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

import { appAlert } from '@/ui/appAlert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors } from '@/theme';

import type {
	ApiError,
	CreateConversationRequest,
	CreateConversationResponse,
	ListingOffer,
	WaveRequest,
	WaveResponse,
} from '@g88/shared';
import type { CommerceStackParamList } from '@/navigation/stacks';
import { useAppSelector } from '@/hooks/redux';
import { postJson } from '@/api/client';
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
import { formatListingExpiry, formatPrice } from '@/features/trading/formatPrice';
import { openRootScreen, openViaRef } from '@/navigation/openRootScreen';
import { signalPostSocialActivation } from '@/features/nudges/postSocialActivation';

type R = RouteProp<CommerceStackParamList, 'ListingDetail'>;

export function ListingDetailScreen(): React.JSX.Element {
	const route = useRoute<R>();
	const navigation = useNavigation();
	const { listingId } = route.params;
	const myId = useAppSelector((s) => s.auth.user?.id);

	const { listing, offers, loading, refresh, refreshOffers } = useListing(listingId);
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
			<View style={S.container}>
				<ScreenHeader title="Listing" />
				<View style={[S.container, S.center]}>
					{loading ? (
						<ActivityIndicator color={colors.primary} />
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
			style={S.container}
			contentContainerStyle={S.content}
			refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
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
				<Image source={{ uri: listing.thumbnailUrl }} style={S.image} />
			) : (
				<View style={[S.image, S.imagePlaceholder]}>
					<Icon name="image-off-outline" size={40} color={colors.borderStrong} />
				</View>
			)}

			<View style={S.body}>
				<Text style={S.title}>{listing.title}</Text>
				<Text style={S.price}>{formatPrice(listing.priceCents, listing.currency)}</Text>
				<View style={S.metaRow}>
					<View style={S.categoryPill}><Text style={S.categoryText}>{listing.category}</Text></View>
					{listing.status !== 'active' ? (
						<View style={S.statusPill}><Text style={S.statusText}>{listing.status}</Text></View>
					) : null}
					{formatListingExpiry(listing.expiresAt) ? (
						<Text style={S.favCount}>{formatListingExpiry(listing.expiresAt)}</Text>
					) : null}
					<Text style={S.favCount}>{listing.favoriteCount} saved</Text>
				</View>

				<View style={S.sellerRow}>
					<TouchableOpacity
						style={S.sellerIdentity}
						activeOpacity={0.7}
						onPress={() => openRootScreen(navigation, 'UserProfile', { userId: listing.sellerId })}
					>
						{listing.sellerAvatarUrl ? (
							<Image source={{ uri: listing.sellerAvatarUrl }} style={S.sellerAvatar} />
						) : (
							<View style={[S.sellerAvatar, S.sellerAvatarPlaceholder]}>
								<Text style={S.sellerInitial}>{listing.sellerDisplayName[0]?.toUpperCase() ?? '?'}</Text>
							</View>
						)}
						<Text style={S.sellerName}>{listing.sellerDisplayName}</Text>
					</TouchableOpacity>
					{!isSeller ? (
						<SellerContactButtons
							sellerId={listing.sellerId}
							sellerName={listing.sellerDisplayName}
						/>
					) : null}
				</View>

				{listing.description ? <Text style={S.description}>{listing.description}</Text> : null}

				{isSeller ? (
					<SellerControls
						listingId={listingId}
						status={listing.status}
						offers={offers}
						currency={listing.currency}
						onChanged={() => { refresh(); refreshOffers(); }}
					/>
				) : (
					<BuyerOffer
						listingId={listingId}
						disabled={listing.status !== 'active'}
						myOffer={listing.myOffer}
						askingCents={listing.priceCents}
						currency={listing.currency}
						onChanged={refresh}
					/>
				)}
			</View>
		</ScrollView>
	);
}
