// apps/mobile/src/navigation/AppNavigator.tsx
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '@/theme';

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
import EmailVerificationScreen from '@/screens/EmailVerificationScreen';
import { SubscriptionScreen } from '@/screens/SubscriptionScreen';
import { SocialLinkingScreen } from '@/screens/SocialLinkingScreen';
import { AchievementsScreen } from '@/screens/AchievementsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ChallengesScreen } from '@/screens/ChallengesScreen';
import { GiftsInboxScreen } from '@/screens/GiftsInboxScreen';
import { InteractionsScreen } from '@/screens/InteractionsScreen';
import VerificationIdScreen from '@/screens/VerificationIdScreen';
import { EventDetailScreen } from '@/screens/EventDetailScreen';
import { EventCreateScreen } from '@/screens/EventCreateScreen';
import { MarketplaceScreen } from '@/screens/MarketplaceScreen';
import { ListingDetailScreen } from '@/screens/ListingDetailScreen';
import { ListingCreateScreen } from '@/screens/ListingCreateScreen';
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen';
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen';
import { PrivacyScreen } from '@/screens/PrivacyScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { AboutScreen } from '@/screens/AboutScreen';
import { FriendsListScreen } from '@/screens/FriendsListScreen';
import type { AreaCategory, VerificationLevel } from '@g88/shared';
import { AuthScreen } from '@/screens/AuthScreen';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession } from '@/features/auth/authSlice';
import {
  registerPushToken,
  setupNotificationHandlers,
} from '@/lib/pushNotifications';
import { pingGamification } from '@/features/gamification/useGamification';
import { AchievementToastHost } from '@/components/AchievementToast';
import { navigationRef } from './navigationRef';
import { openViaRef } from './openRootScreen';
import type {
  AccountStackParamList,
  CommerceStackParamList,
  EventsStackParamList,
  GamificationStackParamList,
} from './stacks';

export type PulseFilter =
  | 'all'
  | 'chats'
  | 'waves'
  | 'listings'
  | 'alerts'
  | 'matches';

export type TabParamList = {
  Map: { focusMyPin?: boolean } | undefined;
  Pulse: { filter?: PulseFilter } | undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  ProfileCreation: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Chat: {
    conversationId: string;
    otherUserName: string;
    requestPending?: boolean;
    /** Peer user id — enables header → profile without waiting for messages. */
    otherUserId?: string;
    /** The other participant's verification ladder level (for the header badge). */
    otherUserVerification?: VerificationLevel;
    /** True when the other participant passed ID review (strong decagram badge). */
    otherUserIdVerified?: boolean;
  };
  UserProfile: { userId: string };
  AlertComposer: { presetCategory?: AreaCategory; presetTag?: string };
  GiftsInbox: undefined;
  Interactions: undefined;
  Gamification: NavigatorScreenParams<GamificationStackParamList>;
  Commerce: NavigatorScreenParams<CommerceStackParamList>;
  Account: NavigatorScreenParams<AccountStackParamList>;
  Events: NavigatorScreenParams<EventsStackParamList>;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const GamificationStack = createNativeStackNavigator<GamificationStackParamList>();
const CommerceStack = createNativeStackNavigator<CommerceStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
export { navigationRef };

const stackScreenOpts = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.textPrimary,
  contentStyle: { backgroundColor: colors.bg },
} as const;

function GamificationNavigator(): React.JSX.Element {
  return (
    <GamificationStack.Navigator screenOptions={stackScreenOpts}>
      <GamificationStack.Screen name="Challenges" component={ChallengesScreen} />
      <GamificationStack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <GamificationStack.Screen name="Achievements" component={AchievementsScreen} />
    </GamificationStack.Navigator>
  );
}

function CommerceNavigator(): React.JSX.Element {
  return (
    <CommerceStack.Navigator screenOptions={stackScreenOpts}>
      <CommerceStack.Screen name="Marketplace" component={MarketplaceScreen} />
      <CommerceStack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <CommerceStack.Screen name="ListingCreate" component={ListingCreateScreen} />
    </CommerceStack.Navigator>
  );
}

function AccountNavigator(): React.JSX.Element {
  return (
    <AccountStack.Navigator screenOptions={stackScreenOpts}>
      <AccountStack.Screen name="Settings" component={SettingsScreen} />
      <AccountStack.Screen name="Privacy" component={PrivacyScreen} />
      <AccountStack.Screen name="Help" component={HelpScreen} />
      <AccountStack.Screen name="About" component={AboutScreen} />
      <AccountStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <AccountStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <AccountStack.Screen name="Verification" component={VerificationScreen} />
      <AccountStack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ title: 'Verify email', presentation: 'modal' }}
      />
      <AccountStack.Screen
        name="VerificationId"
        options={{ title: 'ID Verification', presentation: 'modal' }}
      >
        {() => <VerificationIdScreen />}
      </AccountStack.Screen>
      <AccountStack.Screen name="Subscription" component={SubscriptionScreen} />
      <AccountStack.Screen name="SocialLinking" component={SocialLinkingScreen} />
      <AccountStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <AccountStack.Screen name="Photos" component={PhotosScreen} />
      <AccountStack.Screen
        name="FriendsList"
        component={FriendsListScreen}
        options={{ headerShown: false, title: 'Friends' }}
      />
    </AccountStack.Navigator>
  );
}

function EventsNavigator(): React.JSX.Element {
  return (
    <EventsStack.Navigator screenOptions={stackScreenOpts}>
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
      <EventsStack.Screen name="EventCreate" component={EventCreateScreen} />
    </EventsStack.Navigator>
  );
}

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.surfaceAlt,
          height: 64,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarIcon: ({ color }) => {
          const icons = {
            Map: 'map-marker-radius',
            Pulse: 'pulse',
            Profile: 'account-circle-outline',
          } as const;

          const iconName = icons[route.name as keyof typeof icons] ?? 'circle';
          return (
            <MaterialCommunityIcons name={iconName} size={24} color={color} />
          );
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
  const user = useAppSelector(s => s.auth.user);
  const restoring = useAppSelector(s => s.auth.restoring);
  const profileSetupComplete = useAppSelector(s => s.auth.profileSetupComplete);
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
      return setupNotificationHandlers((screen, params) => {
        openViaRef(screen as Parameters<typeof openViaRef>[0], params);
      });
    }
    if (!user) prevUserRef.current = null;
  }, [user]);

  // Loading screen while we check for a stored session. Gated on `restoring`
  // (not the shared auth `loading`) so an in-progress login/register never
  // unmounts the AuthScreen. Spinner so a slow/offline /auth/me reads as
  // "loading" rather than a frozen black screen.
  if (restoring && user === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {!profileSetupComplete && (
              <Stack.Screen
                name="ProfileCreation"
                component={ProfileCreationScreen}
              />
            )}
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen
              name="AlertComposer"
              component={AlertComposerScreen}
            />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="GiftsInbox" component={GiftsInboxScreen} />
            <Stack.Screen
              name="Interactions"
              component={InteractionsScreen}
              options={{
                headerShown: true,
                title: 'Interactions',
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.textPrimary,
              }}
            />
            <Stack.Screen
              name="Gamification"
              component={GamificationNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Commerce"
              component={CommerceNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Account"
              component={AccountNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Events"
              component={EventsNavigator}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
      {user ? <AchievementToastHost /> : null}
    </NavigationContainer>
  );
}
