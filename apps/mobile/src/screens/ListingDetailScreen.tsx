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
import {colors} from '@/theme';

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
			<View style={S.container}>
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
			style={S.container}
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
						onPress={() => openRootScreen(navigation, 'UserProfile', {userId: listing.sellerId})}
					>
						{listing.sellerAvatarUrl ? (
							<Image source={{uri: listing.sellerAvatarUrl}} style={S.sellerAvatar}/>
						) : (
							<View style={[S.sellerAvatar, S.sellerAvatarPlaceholder]}>
								<Text
									style={S.sellerInitial}>{listing.sellerDisplayName[0]?.toUpperCase() ?? '?'}</Text>
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
						onChanged={() => {
							refresh();
							refreshOffers();
						}}
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

function SellerContactButtons({
								  sellerId,
								  sellerName,
							  }: {
	sellerId: string;
	sellerName: string;
}): React.JSX.Element {
	const navigation = useNavigation<NativeStackNavigationProp<CommerceStackParamList>>();
	const [waving, setWaving] = useState(false);
	const [messaging, setMessaging] = useState(false);

	const onMessage = useCallback(async () => {
		if (messaging) return;
		setMessaging(true);
		try {
			const res = await postJson<CreateConversationRequest, CreateConversationResponse>(
				'/conversations',
				{targetUserId: sellerId},
			);
			void signalPostSocialActivation('message');
			openRootScreen(navigation, 'Chat', {
				conversationId: res.conversationId,
				otherUserName: sellerName,
				otherUserId: sellerId,
				requestPending: res.status === 'pending' && res.permission === 'request',
			});
		} catch (e) {
			const err = e as ApiError;
			appAlert('Could not open chat', err.message || 'Try again.');
		} finally {
			setMessaging(false);
		}
	}, [messaging, sellerId, sellerName, navigation]);

	const onWave = useCallback(async () => {
		setWaving(true);
		try {
			await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
				toUserId: sellerId,
				context: 'profile',
			});
			appAlert('Wave sent', 'The seller will see your wave.');
		} catch (e) {
			const err = e as ApiError;
			appAlert(err.code === 'wave.cooldown' ? 'Already waved' : 'Could not wave', err.message || 'Try again.');
		} finally {
			setWaving(false);
		}
	}, [sellerId]);

	return (
		<View style={S.contactRow}>
			<TouchableOpacity
				style={S.messageBtn}
				onPress={() => void onMessage()}
				disabled={messaging}
				accessibilityRole="button"
				accessibilityLabel="Message seller"
			>
				{messaging ? (
					<ActivityIndicator size="small" color={colors.onPrimary}/>
				) : (
					<Icon name="message-text-outline" size={16} color={colors.onPrimary}/>
				)}
				<Text style={S.waveText}>{messaging ? '…' : 'Message'}</Text>
			</TouchableOpacity>
			<TouchableOpacity style={S.waveBtn} onPress={() => void onWave()} disabled={waving}>
				{waving ? (
					<ActivityIndicator size="small" color={colors.onPrimary}/>
				) : (
					<Icon name="hand-wave" size={16} color={colors.onPrimary}/>
				)}
				<Text style={S.waveText}>Wave</Text>
			</TouchableOpacity>
		</View>
	);
}

function BuyerOffer({
						listingId, disabled, myOffer, askingCents, currency, onChanged,
					}: {
	listingId: string;
	disabled: boolean;
	myOffer: ListingOffer | null;
	askingCents: number;
	currency: string;
	onChanged: () => void;
}): React.JSX.Element {
	const [amount, setAmount] = useState('');
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const [reofferOpen, setReofferOpen] = useState(false);

	const submit = useCallback(async () => {
		let offerCents: number | undefined;
		if (amount.trim()) {
			const parsed = parseFloat(amount);
			if (Number.isNaN(parsed) || parsed < 0) {
				appAlert('Invalid price', 'Please enter a valid offer price, or leave it blank to offer at the asking price.');
				return;
			}
			offerCents = Math.round(parsed * 100);
		}
		setBusy(true);
		try {
			await makeOffer(listingId, {
				...(offerCents != null ? {offerCents} : {}),
				...(message.trim() ? {message: message.trim()} : {}),
			});
			setAmount('');
			setMessage('');
			onChanged();
		} catch (e) {
			appAlert('Could not send offer', (e as ApiError).message || 'Try again.');
		} finally {
			setBusy(false);
		}
	}, [amount, message, listingId, onChanged]);

	const onWithdraw = useCallback(async () => {
		setBusy(true);
		try {
			await withdrawOffer(listingId);
			onChanged();
		} catch {
			/* noop */
		} finally {
			setBusy(false);
		}
	}, [listingId, onChanged]);

	if (myOffer && myOffer.status !== 'withdrawn') {
		const isSellerCounter = myOffer.status === 'pending' && myOffer.lastActor === 'seller';

		const onAcceptCounter = async () => {
			setBusy(true);
			try {
				await respondToOffer(myOffer.id, 'accepted');
				onChanged();
			} catch (e) {
				appAlert('Could not accept', (e as ApiError).message || 'Try again.');
			} finally {
				setBusy(false);
			}
		};

		const onDeclineCounter = async () => {
			setBusy(true);
			try {
				await respondToOffer(myOffer.id, 'declined');
				onChanged();
			} catch (e) {
				appAlert('Could not decline', (e as ApiError).message || 'Try again.');
			} finally {
				setBusy(false);
			}
		};

		if (isSellerCounter && reofferOpen) {
			return (
				<View style={S.card}>
					<Text style={S.cardTitle}>Counter back</Text>
					<Text style={S.counterHint}>
						Seller offered{' '}
						{myOffer.offerCents != null ? formatPrice(myOffer.offerCents, currency) : 'asking'}.
						Send a new amount.
					</Text>
					<TextInput
						style={S.input}
						placeholder={`Your price (asking ${formatPrice(askingCents, currency)})`}
						placeholderTextColor={colors.textFaint}
						value={amount}
						onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
						keyboardType="decimal-pad"
					/>
					<TextInput
						style={[S.input, S.multiline]}
						placeholder="Add a message (optional)"
						placeholderTextColor={colors.textFaint}
						value={message}
						onChangeText={setMessage}
						multiline
					/>
					<TouchableOpacity style={[S.primaryBtn, busy && S.btnDisabled]} disabled={busy}
									  onPress={() => void submit()}>
						{busy ? <ActivityIndicator size="small" color={colors.onPrimary}/> :
							<Text style={S.primaryBtnText}>Send counter</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={[S.secondaryBtn, {marginTop: 10}]} disabled={busy}
									  onPress={() => setReofferOpen(false)}>
						<Text style={S.secondaryBtnText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			);
		}

		return (
			<View style={S.card}>
				<Text style={S.cardTitle}>Your offer</Text>
				{isSellerCounter ? (
					<Text style={S.counterHint}>Seller countered — accept their price, decline, or counter back.</Text>
				) : null}
				<Text style={S.offerLine}>
					{myOffer.offerCents != null ? formatPrice(myOffer.offerCents, currency) : 'At asking price'}
					{'  ·  '}
					<Text style={S.offerStatus}>
						{isSellerCounter ? 'seller countered' : myOffer.status}
					</Text>
				</Text>
				{myOffer.message ? <Text style={S.offerMsg}>{myOffer.message}</Text> : null}
				{myOffer.status === 'pending' ? (
					<>
						{isSellerCounter ? (
							<View style={{marginTop: 12, gap: 10}}>
								<TouchableOpacity
									style={[S.primaryBtn, busy && S.btnDisabled]}
									disabled={busy}
									onPress={() => void onAcceptCounter()}
									accessibilityLabel="Accept counter offer"
								>
									{busy ? (
										<ActivityIndicator size="small" color={colors.onPrimary}/>
									) : (
										<Text style={S.primaryBtnText}>Accept counter</Text>
									)}
								</TouchableOpacity>
								<TouchableOpacity
									style={[S.secondaryBtn, busy && S.btnDisabled]}
									disabled={busy}
									onPress={() => {
										setAmount(myOffer.offerCents != null ? String(myOffer.offerCents / 100) : '');
										setMessage('');
										setReofferOpen(true);
									}}
								>
									<Text style={S.secondaryBtnText}>Counter back</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[S.secondaryBtn, busy && S.btnDisabled]}
									disabled={busy}
									onPress={() => void onDeclineCounter()}
								>
									<Text style={S.secondaryBtnText}>Decline</Text>
								</TouchableOpacity>
							</View>
						) : (
							<TouchableOpacity style={[S.secondaryBtn, {marginTop: 10}]} disabled={busy}
											  onPress={() => void onWithdraw()}>
								<Text style={S.secondaryBtnText}>Withdraw offer</Text>
							</TouchableOpacity>
						)}
					</>
				) : null}
			</View>
		);
	}

	if (disabled) {
		return (
			<View style={S.card}>
				<Text style={S.emptyHint}>This listing is no longer accepting offers.</Text>
			</View>
		);
	}

	return (
		<View style={S.card}>
			<Text style={S.cardTitle}>Make an offer</Text>
			<TextInput
				style={S.input}
				placeholder={`Your price (asking ${formatPrice(askingCents, currency)})`}
				placeholderTextColor={colors.textFaint}
				value={amount}
				onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
				keyboardType="decimal-pad"
			/>
			<TextInput
				style={[S.input, S.multiline]}
				placeholder="Add a message (optional)"
				placeholderTextColor={colors.textFaint}
				value={message}
				onChangeText={setMessage}
				multiline
			/>
			<TouchableOpacity style={[S.primaryBtn, busy && S.btnDisabled]} disabled={busy}
							  onPress={() => void submit()}>
				{busy ? <ActivityIndicator size="small" color={colors.onPrimary}/> :
					<Text style={S.primaryBtnText}>Send offer</Text>}
			</TouchableOpacity>
		</View>
	);
}

function SellerControls({
							listingId, status, offers, currency, onChanged,
						}: {
	listingId: string;
	status: string;
	offers: ListingOffer[];
	currency: string;
	onChanged: () => void;
}): React.JSX.Element {
	const [counterFor, setCounterFor] = useState<string | null>(null);
	const [counterAmount, setCounterAmount] = useState('');
	const [counterMsg, setCounterMsg] = useState('');
	const [counterBusy, setCounterBusy] = useState(false);
	const [bumping, setBumping] = useState(false);

	const respond = useCallback(
		async (offerId: string, decision: 'accepted' | 'declined') => {
			try {
				await respondToOffer(offerId, decision);
				onChanged();
			} catch (e) {
				appAlert('Could not respond', (e as ApiError).message || 'Try again.');
			}
		},
		[onChanged],
	);

	const submitCounter = useCallback(
		async (offerId: string) => {
			const parsed = parseFloat(counterAmount);
			if (Number.isNaN(parsed) || parsed < 0) {
				appAlert('Invalid price', 'Enter a valid counter amount.');
				return;
			}
			setCounterBusy(true);
			try {
				await counterOffer(offerId, {
					offerCents: Math.round(parsed * 100),
					...(counterMsg.trim() ? {message: counterMsg.trim()} : {}),
				});
				setCounterFor(null);
				setCounterAmount('');
				setCounterMsg('');
				onChanged();
			} catch (e) {
				appAlert('Could not counter', (e as ApiError).message || 'Try again.');
			} finally {
				setCounterBusy(false);
			}
		},
		[counterAmount, counterMsg, onChanged],
	);

	const setStatus = useCallback(
		async (next: 'sold' | 'withdrawn') => {
			try {
				await updateListingStatus(listingId, next);
				onChanged();
			} catch (e) {
				appAlert('Could not update', (e as ApiError).message || 'Try again.');
			}
		},
		[listingId, onChanged],
	);

	const onBump = useCallback(async () => {
		setBumping(true);
		try {
			await bumpListing(listingId);
			onChanged();
		} catch (e) {
			appAlert('Could not bump', (e as ApiError).message || 'Try again.');
		} finally {
			setBumping(false);
		}
	}, [listingId, onChanged]);

	const pending = offers.filter((o) => o.status === 'pending');

	return (
		<View>
			{status === 'active' ? (
				<View style={S.sellerActions}>
					<TouchableOpacity style={S.secondaryBtn} onPress={() => void onBump()} disabled={bumping}>
						{bumping ? <ActivityIndicator size="small" color={colors.primary}/> :
							<Text style={S.secondaryBtnText}>Bump listing</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={S.secondaryBtn} onPress={() => void setStatus('sold')}>
						<Text style={S.secondaryBtnText}>Mark sold</Text>
					</TouchableOpacity>
					<TouchableOpacity style={S.secondaryBtn} onPress={() => void setStatus('withdrawn')}>
						<Text style={S.secondaryBtnText}>Withdraw</Text>
					</TouchableOpacity>
				</View>
			) : null}

			<Text style={S.sectionTitle}>Offers ({pending.length} pending)</Text>
			{offers.length === 0 ? (
				<Text style={S.emptyHint}>No offers yet.</Text>
			) : (
				offers.map((o) => (
					<View key={o.id} style={S.card}>
						<Text style={S.offerLine}>
							{o.offerCents != null ? formatPrice(o.offerCents, currency) : 'At asking'}
							{'  ·  '}
							<Text
								style={S.offerStatus}>{o.status}{o.lastActor === 'seller' ? ' (you countered)' : ''}</Text>
						</Text>
						{o.message ? <Text style={S.offerMsg}>{o.message}</Text> : null}
						{o.status === 'pending' && o.lastActor !== 'seller' ? (
							<>
								{counterFor === o.id ? (
									<View style={{marginTop: 10}}>
										<TextInput
											style={S.input}
											placeholder="Counter amount"
											placeholderTextColor={colors.textFaint}
											value={counterAmount}
											onChangeText={(t) => setCounterAmount(t.replace(/[^0-9.]/g, ''))}
											keyboardType="decimal-pad"
										/>
										<TextInput
											style={[S.input, S.multiline]}
											placeholder="Message (optional)"
											placeholderTextColor={colors.textFaint}
											value={counterMsg}
											onChangeText={setCounterMsg}
											multiline
										/>
										<View style={S.offerActions}>
											<TouchableOpacity style={S.acceptBtn} disabled={counterBusy}
															  onPress={() => void submitCounter(o.id)}>
												{counterBusy ?
													<ActivityIndicator size="small" color={colors.onPrimary}/> :
													<Icon name="check" size={18} color={colors.onPrimary}/>}
											</TouchableOpacity>
											<TouchableOpacity style={S.declineBtn} disabled={counterBusy}
															  onPress={() => setCounterFor(null)}>
												<Icon name="close" size={18} color={colors.textPrimary}/>
											</TouchableOpacity>
										</View>
									</View>
								) : (
									<View style={[S.offerActions, {marginTop: 10}]}>
										<TouchableOpacity style={S.acceptBtn}
														  onPress={() => void respond(o.id, 'accepted')}
														  accessibilityLabel="Accept offer">
											<Icon name="check" size={18} color={colors.onPrimary}/>
										</TouchableOpacity>
										<TouchableOpacity style={S.counterBtn} onPress={() => {
											setCounterFor(o.id);
											setCounterAmount(o.offerCents != null ? String(o.offerCents / 100) : '');
											setCounterMsg('');
										}} accessibilityLabel="Counter offer">
											<Icon name="swap-horizontal" size={18} color={colors.textPrimary}/>
										</TouchableOpacity>
										<TouchableOpacity style={S.declineBtn}
														  onPress={() => void respond(o.id, 'declined')}
														  accessibilityLabel="Decline offer">
											<Icon name="close" size={18} color={colors.textPrimary}/>
										</TouchableOpacity>
									</View>
								)}
							</>
						) : null}
					</View>
				))
			)}
		</View>
	);
}

const S = StyleSheet.create({
	container: {flex: 1, backgroundColor: colors.bg},
	content: {paddingBottom: 48},
	center: {alignItems: 'center', justifyContent: 'center'},
	body: {paddingHorizontal: 20},
	image: {width: '100%', height: 220, backgroundColor: colors.surface},
	imagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
	title: {color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 16},
	price: {color: colors.primary, fontSize: 20, fontWeight: '700', marginTop: 6},
	metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10},
	categoryPill: {backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4},
	categoryText: {color: colors.textSecondary, fontSize: 12, fontWeight: '600'},
	statusPill: {backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4},
	statusText: {color: colors.warning, fontSize: 12, fontWeight: '600', textTransform: 'capitalize'},
	favCount: {color: colors.textMuted, fontSize: 13},
	sellerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16},
	sellerIdentity: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
	sellerAvatar: {width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface},
	sellerAvatarPlaceholder: {alignItems: 'center', justifyContent: 'center'},
	sellerInitial: {color: colors.primary, fontSize: 15, fontWeight: '700'},
	sellerName: {color: colors.textSecondary, fontSize: 15, fontWeight: '600'},
	description: {color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 16},
	contactRow: {flexDirection: 'row', gap: 8},
	messageBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors.primary,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8
	},
	waveBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors.primary,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8
	},
	waveText: {color: colors.onPrimary, fontSize: 13, fontWeight: '700'},
	card: {
		marginTop: 16,
		padding: 16,
		backgroundColor: colors.surface,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border
	},
	cardTitle: {color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10},
	input: {
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: colors.textPrimary,
		fontSize: 15,
		marginBottom: 10
	},
	multiline: {minHeight: 72, textAlignVertical: 'top'},
	primaryBtn: {backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center'},
	primaryBtnText: {color: colors.onPrimary, fontSize: 14, fontWeight: '700'},
	secondaryBtn: {
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: 10,
		paddingVertical: 12,
		alignItems: 'center',
		paddingHorizontal: 12
	},
	secondaryBtnText: {color: colors.textPrimary, fontSize: 14, fontWeight: '600'},
	btnDisabled: {opacity: 0.4},
	offerLine: {color: colors.textSecondary, fontSize: 15, fontWeight: '600'},
	offerStatus: {color: colors.textMuted, fontWeight: '500', textTransform: 'capitalize'},
	offerMsg: {color: colors.textMuted, fontSize: 13, marginTop: 6},
	counterHint: {color: colors.textMuted, fontSize: 13, marginBottom: 10},
	emptyHint: {color: colors.textFaint, fontSize: 14, marginTop: 8},
	sectionTitle: {color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8},
	sellerActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16},
	offerActions: {flexDirection: 'row', gap: 8},
	acceptBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center'
	},
	counterBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: 'center',
		justifyContent: 'center'
	},
	declineBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.borderStrong,
		alignItems: 'center',
		justifyContent: 'center'
	},
});
