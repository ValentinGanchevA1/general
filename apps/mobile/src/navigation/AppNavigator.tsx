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

export type PulseFilter =
  | 'all'
  | 'chats'
  | 'waves'
  | 'listings'
  | 'alerts'
  | 'matches';

export type TabParamList = {
  Map: undefined;
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
    otherUserVerification?: VerificationLevel;
    otherUserIdVerified?: boolean;
  };
  ProfileEdit: undefined;
  Photos: undefined;
  Settings: undefined;
  AlertComposer: { presetCategory?: AreaCategory; presetTag?: string };
  UserProfile: { userId: string };
  Verification: undefined;
  EmailVerification: undefined;
  Subscription: undefined;
  SocialLinking: undefined;
  Achievements: undefined;
  Leaderboard: undefined;
  Challenges: undefined;
  VerificationId: undefined;
  EventDetail: { eventId: string };
  EventCreate: undefined;
  Marketplace: undefined;
  ListingDetail: { listingId: string };
  ListingCreate: undefined;
  NotificationSettings: undefined;
  BlockedUsers: undefined;
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
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#1a1a2e',
          height: 64,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icon =
            route.name === 'Map'
              ? 'map-marker-radius'
              : route.name === 'Pulse'
                ? 'pulse'
                : 'account-circle';
          return <MaterialCommunityIcons name={icon} color={color} size={size} />;
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
  const { accessToken, restoring, profileSetupComplete } = useAppSelector((s) => s.auth);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void dispatch(restoreSession());
    setupNotificationHandlers();
  }, [dispatch]);

  useEffect(() => {
    if (!accessToken) return;
    void registerPushToken();
    void pingGamification();
  }, [accessToken]);

  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center' }}>
        <ActivityIndicator color="#00d4ff" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0f' } }}>
        {!accessToken ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !profileSetupComplete ? (
          <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            <Stack.Screen name="Photos" component={PhotosScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="AlertComposer" component={AlertComposerScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen
              name="EmailVerification"
              component={EmailVerificationScreen}
              options={{ title: 'Verify email', presentation: 'modal' }}
            />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="SocialLinking" component={SocialLinkingScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Challenges" component={ChallengesScreen} />
            <Stack.Screen
              name="VerificationId"
              options={{ title: 'ID Verification', presentation: 'modal' }}
            >
              {() => <VerificationIdScreen />}
            </Stack.Screen>
            <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            <Stack.Screen name="EventCreate" component={EventCreateScreen} />
            <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
            <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
            <Stack.Screen name="ListingCreate" component={ListingCreateScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
            <Stack.Screen name="GiftsInbox" component={GiftsInboxScreen} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
          </>
        )}
      </Stack.Navigator>
      <AchievementToastHost />
    </NavigationContainer>
  );
}
