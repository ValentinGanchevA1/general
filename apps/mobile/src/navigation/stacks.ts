// Nested stack param lists — grouped by product pillar.
// Root mounts each as a single Stack.Screen; use openRootScreen() from outside.

import type { NavigatorScreenParams } from '@react-navigation/native';

export type GamificationStackParamList = {
  Challenges: undefined;
  Leaderboard: undefined;
  Achievements: undefined;
};

export type CommerceStackParamList = {
  Marketplace: undefined;
  ListingDetail: { listingId: string };
  ListingCreate: { mode?: 'sell' | 'buy' } | undefined;
};

export type AccountStackParamList = {
  Settings: undefined;
  Privacy: undefined;
  Help: undefined;
  About: undefined;
  NotificationSettings: undefined;
  BlockedUsers: undefined;
  Verification: { initialPhone?: string } | undefined;
  EmailVerification: undefined;
  VerificationId: undefined;
  Subscription: undefined;
  SocialLinking: undefined;
  ProfileEdit: undefined;
  Photos: undefined;
  FriendsList: undefined;
  Suggestions: undefined;
};

export type EventsStackParamList = {
  EventDetail: { eventId: string };
  EventCreate: undefined;
};

export type NestedStackName =
  | 'Gamification'
  | 'Commerce'
  | 'Account'
  | 'Events';

export type NestedStackParams = {
  Gamification: NavigatorScreenParams<GamificationStackParamList>;
  Commerce: NavigatorScreenParams<CommerceStackParamList>;
  Account: NavigatorScreenParams<AccountStackParamList>;
  Events: NavigatorScreenParams<EventsStackParamList>;
};
