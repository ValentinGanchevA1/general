// apps/mobile/src/navigation/AppNavigator.tsx
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { MapScreen } from '@/screens/MapScreen';
import { PulseScreen } from '@/features/pulse/PulseScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { UserProfileScreen } from '@/screens/UserProfileScreen';
import { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';
import { ProfileEditScreen } from '@/screens/ProfileEditScreen';
import { PhotosScreen } from '@/screens/PhotosScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AlertComposerScreen } from '@/screens/AlertComposerScreen';
import { VerificationScreen } from '@/screens/VerificationScreen';
import { SubscriptionScreen } from '@/screens/SubscriptionScreen';
import { SocialLinkingScreen } from '@/screens/SocialLinkingScreen';
import { AchievementsScreen } from '@/screens/AchievementsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ChallengesScreen } from '@/screens/ChallengesScreen';
import { GiftsInboxScreen } from '@/screens/GiftsInboxScreen';
import VerificationIdScreen from '@/screens/VerificationIdScreen';
import {
	PrivacyScreen,
	HelpScreen,
	AboutScreen,
} from '@/screens/placeholders';
import type { AreaCategory } from '@g88/shared';
import { AuthScreen } from '@/screens/AuthScreen';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession } from '@/features/auth/authSlice';
import { registerPushToken, setupNotificationHandlers } from '@/lib/pushNotifications';
import { pingGamification } from '@/features/gamification/useGamification';
import { AchievementToastHost } from '@/components/AchievementToast';
import { navigationRef } from './navigationRef';

export type PulseFilter = 'all' | 'chats' | 'waves' | 'listings' | 'alerts' | 'matches';

export type TabParamList = {
	Map: undefined;
	Pulse: { filter?: PulseFilter } | undefined;
	Profile: undefined;
};

export type RootStackParamList = {
	Auth: undefined;
	ProfileCreation: undefined;
	Main: NavigatorScreenParams<TabParamList> | undefined;
	Chat: { conversationId: string; otherUserName: string; requestPending?: boolean };
	ProfileEdit: undefined;
	Photos: undefined;
	Settings: undefined;
	AlertComposer: { presetCategory?: AreaCategory; presetTag?: string };
	UserProfile: { userId: string };
	Verification: undefined;
	Subscription: undefined;
	SocialLinking: undefined;
	Achievements: undefined;
	Leaderboard: undefined;
	Challenges: undefined;
	VerificationId: undefined;
	GiftsInbox: undefined;
	Privacy: undefined;
	Help: undefined;
	About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
export { navigationRef };

function MainTabs(): React.JSX.Element {
	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				headerShown: false,
				tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: '#1a1a2e', height: 64, paddingTop: 6 },
				tabBarActiveTintColor: '#00d4ff',
				tabBarInactiveTintColor: '#555',
				tabBarIcon: ({ color, size }) => {
					const icons = {
						Map: 'map-marker-radius',
						Pulse: 'pulse',
						Profile: 'account-circle-outline',
					} as const;

					const iconName = icons[route.name as keyof typeof icons] ?? 'circle';
					return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
				},
			})}
		>
			<Tab.Screen name="Map" component={MapScreen} />
			<Tab.Screen name="Pulse" component={PulseScreen} />
			<Tab.Screen name="Profile" component={ProfileScreen} />
		</Tab.Navigator>
	);
}

export function AppNavigator(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const user = useAppSelector((s) => s.auth.user);
	const restoring = useAppSelector((s) => s.auth.restoring);
	const profileSetupComplete = useAppSelector((s) => s.auth.profileSetupComplete);
	const prevUserRef = useRef<string | null>(null);

	useEffect(() => {
		void dispatch(restoreSession());
	}, [dispatch]);

	// Register FCM token whenever the user logs in (null → id transition).
	useEffect(() => {
		if (user && prevUserRef.current !== user.id) {
			prevUserRef.current = user.id;
			void registerPushToken();
			void pingGamification(); // advance daily streak on login/session restore
			const cleanup = setupNotificationHandlers((screen, params) => {
				if (navigationRef.isReady()) {
					navigationRef.navigate(screen as keyof RootStackParamList, params as never);
				}
			});
			return cleanup;
		}
		if (!user) prevUserRef.current = null;
	}, [user]);

	// Loading screen while we check for a stored session. Gated on `restoring`
	// (not the shared auth `loading`) so an in-progress login/register never
	// unmounts the AuthScreen. Spinner so a slow/offline /auth/me reads as
	// "loading" rather than a frozen black screen.
	if (restoring && user === null) {
		return (
			<View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
				<ActivityIndicator size="large" color="#00d4ff" />
			</View>
		);
	}

	return (
		<NavigationContainer ref={navigationRef}>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				{user ? (
					<>
						{!profileSetupComplete && (
							<Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
						)}
						<Stack.Screen name="Main" component={MainTabs} />
						<Stack.Screen name="Chat" component={ChatScreen} />
						<Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
						<Stack.Screen name="Photos" component={PhotosScreen} />
						<Stack.Screen name="Settings" component={SettingsScreen} />
						<Stack.Screen name="AlertComposer" component={AlertComposerScreen} />
						<Stack.Screen name="UserProfile" component={UserProfileScreen} />
						<Stack.Screen name="Verification" component={VerificationScreen} />
						<Stack.Screen name="Subscription" component={SubscriptionScreen} />
						<Stack.Screen name="SocialLinking" component={SocialLinkingScreen} />
						<Stack.Screen name="Achievements" component={AchievementsScreen} />
						<Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
						<Stack.Screen
							name="VerificationId"
							component={VerificationIdScreen}
							options={{ title: 'ID Verification', presentation: 'modal' }}
						/>
						<Stack.Screen name="Challenges" component={ChallengesScreen} />
						<Stack.Screen name="GiftsInbox" component={GiftsInboxScreen} />
						<Stack.Screen name="Privacy" component={PrivacyScreen} />
						<Stack.Screen name="Help" component={HelpScreen} />
						<Stack.Screen name="About" component={AboutScreen} />
					</>
				) : (
					<>
						<Stack.Screen name="Auth" component={AuthScreen} />
					</>
				)}
			</Stack.Navigator>
			{user ? <AchievementToastHost /> : null}
		</NavigationContainer>
	);
}
