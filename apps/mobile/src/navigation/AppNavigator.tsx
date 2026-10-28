// apps/mobile/src/navigation/AppNavigator.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { BrandLogo } from '@/components/Brand/BrandLogo';
import { useNexaLaunchInteractionsReady } from '@/components/Brand/NexaLaunchSurfaceContext';
import {
	DarkTheme,
	DefaultTheme,
	NavigationContainer,
	type NavigatorScreenParams,
	type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAppTheme, type ThemeColors } from '@/theme';

import { MapScreen } from '@/screens/MapScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { PulseScreen } from '@/features/pulse/PulseScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { UserProfileScreen } from '@/screens/UserProfileScreen';
import { MutualFriendsScreen } from '@/screens/MutualFriendsScreen';
import { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';
import { ProfileEditScreen } from '@/screens/ProfileEditScreen';
import { PhotosScreen } from '@/screens/PhotosScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AlertComposerScreen } from '@/screens/AlertComposerScreen';
import { VerificationScreen } from '@/screens/VerificationScreen';
import EmailVerificationScreen from '@/screens/EmailVerificationScreen';
import { SubscriptionScreen } from '@/screens/SubscriptionScreen';
import { SocialLinkingScreen } from '@/screens/SocialLinkingScreen';
import { AchievementsScreen } from '@/screens/AchievementsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ChallengesScreen } from '@/screens/ChallengesScreen';
import { GiftsInboxScreen } from '@/screens/GiftsInboxScreen';
import { InteractionsScreen } from '@/screens/InteractionsScreen';
import VerificationIdScreen from '@/screens/VerificationIdScreen';
import { TrustCenterScreen } from '@/screens/TrustCenterScreen';
import { EventDetailScreen } from '@/screens/EventDetailScreen';
import { EventCreateScreen } from '@/screens/EventCreateScreen';
import { MarketplaceScreen } from '@/screens/MarketplaceScreen';
import { ListingDetailScreen } from '@/screens/ListingDetailScreen';
import { ListingCreateScreen } from '@/screens/ListingCreateScreen';
import { PlaceDetailScreen } from '@/screens/PlaceDetailScreen';
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen';
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen';
import { PrivacyScreen } from '@/screens/PrivacyScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { AboutScreen } from '@/screens/AboutScreen';
import { FriendsListScreen } from '@/screens/FriendsListScreen';
import { SuggestionsScreen } from '@/screens/SuggestionsScreen';
import type { AreaCategory, VerificationLevel } from '@g88/shared';
import { AuthScreen } from '@/screens/AuthScreen';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession } from '@/features/auth/authSlice';
import { registerPushToken, setupNotificationHandlers } from '@/lib/pushNotifications';
import { pingGamification } from '@/features/gamification/useGamification';
import { AmbientToastHost } from '@/components/AmbientToastHost';
import { AppAlertHost } from '@/components/AppAlertHost';
import { navigationIntegration } from '@/lib/sentry';
import { navigationRef } from './navigationRef';
import { openViaRef } from './openRootScreen';
import { takePendingPhoneVerify } from '@/services/pendingPhone';
import { NexaTabIcon } from './NexaTabIcon';
import { NEXA_TAB_VISUALS, resolveConnectionsTabBadge } from './nexaTabIdentity';
import type { AccountStackParamList, CommerceStackParamList, EventsStackParamList, GamificationStackParamList, SocialStackParamList } from './stacks';

export type PulseFilter = 'for-you' | 'nearby' | 'events' | 'marketplace';
export type TabParamList = {
	Map: { focusMyPin?: boolean; focusUserId?: string; focusListingId?: string; focusLat?: number; focusLng?: number; openCreate?: boolean } | undefined;
	Discover: undefined;
	Pulse: { filter?: PulseFilter } | undefined;
	Connections: undefined;
	You: undefined;
};
export type RootStackParamList = {
	Auth: undefined;
	ProfileCreation: undefined;
	Main: NavigatorScreenParams<TabParamList> | undefined;
	Chat: { conversationId: string; otherUserName: string; requestPending?: boolean; otherUserId?: string; otherUserVerification?: VerificationLevel; otherUserIdVerified?: boolean };
	UserProfile: { userId: string; focus?: 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual' };
	MutualFriends: { peerUserId: string; peerName?: string };
	PlaceDetail: { placeId: string };
	AlertComposer: { presetCategory?: AreaCategory; presetTag?: string };
	GiftsInbox: undefined;
	/** Compatibility fallback. New re-entry routes to Main → Connections. */
	Interactions: undefined;
	Gamification: NavigatorScreenParams<GamificationStackParamList>;
	Commerce: NavigatorScreenParams<CommerceStackParamList>;
	Account: NavigatorScreenParams<AccountStackParamList>;
	Social: NavigatorScreenParams<SocialStackParamList>;
	Events: NavigatorScreenParams<EventsStackParamList>;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const GamificationStack = createNativeStackNavigator<GamificationStackParamList>();
const CommerceStack = createNativeStackNavigator<CommerceStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const SocialStack = createNativeStackNavigator<SocialStackParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
export { navigationRef };

function useStackScreenOptions() {
	const { colors } = useAppTheme();
	return { headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary, headerTitleStyle: { color: colors.textPrimary }, contentStyle: { backgroundColor: colors.bg } } as const;
}

function GamificationNavigator(): React.JSX.Element {
	const screenOptions = useStackScreenOptions();
	return <GamificationStack.Navigator screenOptions={screenOptions}><GamificationStack.Screen name="Challenges" component={ChallengesScreen} /><GamificationStack.Screen name="Leaderboard" component={LeaderboardScreen} /><GamificationStack.Screen name="Achievements" component={AchievementsScreen} /></GamificationStack.Navigator>;
}
function CommerceNavigator(): React.JSX.Element {
	const screenOptions = useStackScreenOptions();
	return <CommerceStack.Navigator screenOptions={screenOptions}><CommerceStack.Screen name="Marketplace" component={MarketplaceScreen} /><CommerceStack.Screen name="ListingDetail" component={ListingDetailScreen} /><CommerceStack.Screen name="ListingCreate" component={ListingCreateScreen} /></CommerceStack.Navigator>;
}
function AccountNavigator(): React.JSX.Element {
	const screenOptions = useStackScreenOptions();
	return <AccountStack.Navigator screenOptions={screenOptions}>
		<AccountStack.Screen name="Settings" component={SettingsScreen} />
		<AccountStack.Screen name="TrustCenter" component={TrustCenterScreen} options={{ headerShown: false, title: 'Trust' }} />
		<AccountStack.Screen name="Privacy" component={PrivacyScreen} /><AccountStack.Screen name="Help" component={HelpScreen} /><AccountStack.Screen name="About" component={AboutScreen} /><AccountStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} /><AccountStack.Screen name="BlockedUsers" component={BlockedUsersScreen} /><AccountStack.Screen name="Verification" component={VerificationScreen} />
		<AccountStack.Screen name="EmailVerification" component={EmailVerificationScreen} options={{ title: 'Verify email', presentation: 'modal' }} />
		<AccountStack.Screen name="VerificationId" options={{ headerShown: false, title: 'ID Verification', presentation: 'modal' }}>{() => <VerificationIdScreen />}</AccountStack.Screen>
		<AccountStack.Screen name="Subscription" component={SubscriptionScreen} /><AccountStack.Screen name="SocialLinking" component={SocialLinkingScreen} />
		<AccountStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ headerShown: false, title: 'Edit profile' }} /><AccountStack.Screen name="Photos" component={PhotosScreen} />
	</AccountStack.Navigator>;
}
function SocialNavigator(): React.JSX.Element {
	const screenOptions = useStackScreenOptions();
	return <SocialStack.Navigator screenOptions={screenOptions}><SocialStack.Screen name="FriendsList" component={FriendsListScreen} options={{ headerShown: false, title: 'Friends' }} /><SocialStack.Screen name="Suggestions" component={SuggestionsScreen} options={{ headerShown: false, title: 'Suggestions' }} /></SocialStack.Navigator>;
}
function EventsNavigator(): React.JSX.Element {
	const screenOptions = useStackScreenOptions();
	return <EventsStack.Navigator screenOptions={screenOptions}><EventsStack.Screen name="EventDetail" component={EventDetailScreen} /><EventsStack.Screen name="EventCreate" component={EventCreateScreen} /></EventsStack.Navigator>;
}

function MainTabs(): React.JSX.Element {
	const { colors: c } = useAppTheme();
	const chatUnread = useAppSelector((s) => s.chat.conversations.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0));
	const friendPending = useAppSelector((s) => s.friends.pendingCount);
	const connectionsBadge = resolveConnectionsTabBadge(chatUnread, friendPending);
	const badgeStyle = { backgroundColor: c.actionPrimary, color: c.onPrimary, fontSize: 10, fontWeight: '800' as const, minWidth: 18, height: 18, lineHeight: 18 };

	return <Tab.Navigator
		screenOptions={({ route }) => {
			const visual = NEXA_TAB_VISUALS[route.name];
			const active = visual.tone === 'discovery' ? c.discovery : c.actionPrimary;
			return {
				headerShown: false,
				tabBarHideOnKeyboard: true,
				tabBarStyle: {
					backgroundColor: c.canvas,
					borderTopColor: c.borderSubtle,
					minHeight: 64,
					paddingTop: 4,
					paddingBottom: 4,
				},
				tabBarItemStyle: { minWidth: 44 },
				tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
				tabBarActiveTintColor: active,
				tabBarInactiveTintColor: c.textTertiary,
				tabBarAccessibilityLabel: visual.accessibilityLabel,
				tabBarIcon: ({ focused }) => <NexaTabIcon tab={route.name} focused={focused} />,
			};
		}}
	>
		<Tab.Screen name="Map" component={MapScreen} />
		<Tab.Screen name="Discover" component={DiscoverScreen} />
		<Tab.Screen name="Pulse" component={PulseScreen} />
		<Tab.Screen
			name="Connections"
			component={InteractionsScreen}
			options={connectionsBadge != null ? { tabBarBadge: connectionsBadge, tabBarBadgeStyle: badgeStyle } : {}}
		/>
		<Tab.Screen name="You" component={ProfileScreen} />
	</Tab.Navigator>;
}

function buildNavigationTheme(colors: ThemeColors, dark: boolean): NavigationTheme {
	const base = dark ? DarkTheme : DefaultTheme;
	return { ...base, dark, colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.surface, text: colors.textPrimary, border: colors.border, notification: colors.danger } };
}

export function AppNavigator(): React.JSX.Element {
	const { colors: themeColors, scheme } = useAppTheme();
	const dispatch = useAppDispatch();
	const user = useAppSelector((s) => s.auth.user);
	const userId = user?.id ?? null;
	const restoring = useAppSelector((s) => s.auth.restoring);
	const profileSetupComplete = useAppSelector((s) => s.auth.profileSetupComplete);
	const launchInteractionsReady = useNexaLaunchInteractionsReady();
	const prevUserRef = useRef<string | null>(null);
	const navigationTheme = useMemo(() => buildNavigationTheme(themeColors, scheme === 'dark'), [themeColors, scheme]);
	useEffect(() => { void dispatch(restoreSession()); }, [dispatch]);
	useEffect(() => { if (!userId) return; return setupNotificationHandlers((screen, params) => { openViaRef(screen as Parameters<typeof openViaRef>[0], params); }); }, [userId]);
	useEffect(() => { if (!launchInteractionsReady) return; if (userId && prevUserRef.current !== userId) { prevUserRef.current = userId; void registerPushToken(); void pingGamification(); } if (!userId) prevUserRef.current = null; }, [launchInteractionsReady, userId]);
	useEffect(() => { if (!launchInteractionsReady || !userId || restoring) return; let cancelled = false; const t = setTimeout(() => { void (async () => { const phone = await takePendingPhoneVerify(); if (cancelled || !phone) return; openViaRef('Verification', { initialPhone: phone }); })(); }, 700); return () => { cancelled = true; clearTimeout(t); }; }, [launchInteractionsReady, userId, restoring]);
	if (restoring && user === null) return <View style={{ flex: 1, backgroundColor: themeColors.bg, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Loading" accessibilityRole="progressbar"><BrandLogo size={120} /></View>;
	return <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={() => { navigationIntegration.registerNavigationContainer(navigationRef); }}><BottomSheetModalProvider>
		<Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.bg } }}>
			{user ? <>{!profileSetupComplete && <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />}<Stack.Screen name="Main" component={MainTabs} /><Stack.Screen name="Chat" component={ChatScreen} /><Stack.Screen name="AlertComposer" component={AlertComposerScreen} /><Stack.Screen name="UserProfile" component={UserProfileScreen} /><Stack.Screen name="MutualFriends" component={MutualFriendsScreen} options={{ headerShown: false }} /><Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} /><Stack.Screen name="GiftsInbox" component={GiftsInboxScreen} /><Stack.Screen name="Interactions" component={InteractionsScreen} options={{ headerShown: false }} /><Stack.Screen name="Gamification" component={GamificationNavigator} options={{ headerShown: false }} /><Stack.Screen name="Commerce" component={CommerceNavigator} options={{ headerShown: false }} /><Stack.Screen name="Account" component={AccountNavigator} options={{ headerShown: false }} /><Stack.Screen name="Social" component={SocialNavigator} options={{ headerShown: false }} /><Stack.Screen name="Events" component={EventsNavigator} options={{ headerShown: false }} /></> : <Stack.Screen name="Auth" component={AuthScreen} />}
		</Stack.Navigator>{user ? <AmbientToastHost /> : null}<AppAlertHost />
	</BottomSheetModalProvider></NavigationContainer>;
}
