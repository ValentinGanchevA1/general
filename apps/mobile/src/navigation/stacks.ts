// Nested stack param lists — grouped by product pillar.
// Root mounts each as a single Stack.Screen; use openRootScreen() from outside.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { LatLng } from '@g88/shared';

export type GamificationStackParamList = {
  Challenges: undefined;
  Leaderboard: undefined;
  Achievements: undefined;
};

export type CommerceStackParamList = {
  Marketplace: undefined;
  ListingDetail: { listingId: string };
  ListingCreate:
    | {
        mode?: 'sell' | 'buy';
        initialLocation?: LatLng;
      }
    | undefined;
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
};

export type SocialStackParamList = {
  FriendsList: undefined;
  Suggestions: undefined;
};

export type EventsStackParamList = {
  EventDetail: { eventId: string };
  EventCreate: { initialLocation?: LatLng } | undefined;
};

export type NestedStackName =
  | 'Gamification'
  | 'Commerce'
  | 'Account'
  | 'Social'
  | 'Events';

export type NestedStackParams = {
  Gamification: NavigatorScreenParams<GamificationStackParamList>;
  Commerce: NavigatorScreenParams<CommerceStackParamList>;
  Account: NavigatorScreenParams<AccountStackParamList>;
  Social: NavigatorScreenParams<SocialStackParamList>;
  Events: NavigatorScreenParams<EventsStackParamList>;
};
