// Map logical leaf screen names → nested stack navigation.
// Use from Main tabs, map chrome, toasts, push — not from inside the nested stack itself.

import { navigationRef } from './navigationRef';

type Leaf =
  | 'Challenges'
  | 'Leaderboard'
  | 'Achievements'
  | 'Marketplace'
  | 'ListingDetail'
  | 'ListingCreate'
  | 'Settings'
  | 'Privacy'
  | 'Help'
  | 'About'
  | 'NotificationSettings'
  | 'BlockedUsers'
  | 'Verification'
  | 'EmailVerification'
  | 'VerificationId'
  | 'Subscription'
  | 'SocialLinking'
  | 'ProfileEdit'
  | 'Photos'
  | 'EventDetail'
  | 'EventCreate'
  | 'GiftsInbox'
  | 'Interactions'
  | 'UserProfile'
  | 'Chat'
  | 'AlertComposer';

const NEST: Partial<
  Record<Leaf, { stack: 'Gamification' | 'Commerce' | 'Account' | 'Events'; screen: string }>
> = {
  Challenges: { stack: 'Gamification', screen: 'Challenges' },
  Leaderboard: { stack: 'Gamification', screen: 'Leaderboard' },
  Achievements: { stack: 'Gamification', screen: 'Achievements' },
  Marketplace: { stack: 'Commerce', screen: 'Marketplace' },
  ListingDetail: { stack: 'Commerce', screen: 'ListingDetail' },
  ListingCreate: { stack: 'Commerce', screen: 'ListingCreate' },
  Settings: { stack: 'Account', screen: 'Settings' },
  Privacy: { stack: 'Account', screen: 'Privacy' },
  Help: { stack: 'Account', screen: 'Help' },
  About: { stack: 'Account', screen: 'About' },
  NotificationSettings: { stack: 'Account', screen: 'NotificationSettings' },
  BlockedUsers: { stack: 'Account', screen: 'BlockedUsers' },
  Verification: { stack: 'Account', screen: 'Verification' },
  EmailVerification: { stack: 'Account', screen: 'EmailVerification' },
  VerificationId: { stack: 'Account', screen: 'VerificationId' },
  Subscription: { stack: 'Account', screen: 'Subscription' },
  SocialLinking: { stack: 'Account', screen: 'SocialLinking' },
  ProfileEdit: { stack: 'Account', screen: 'ProfileEdit' },
  Photos: { stack: 'Account', screen: 'Photos' },
  EventDetail: { stack: 'Events', screen: 'EventDetail' },
  EventCreate: { stack: 'Events', screen: 'EventCreate' },
};

type NavLike = {
  navigate: (...args: never[]) => void;
};

export function openRootScreen(
  navigation: NavLike,
  name: Leaf,
  params?: object,
): void {
  const nested = NEST[name];
  if (nested) {
    if (params != null) {
      (navigation.navigate as (a: string, b: object) => void)(nested.stack, {
        screen: nested.screen,
        params,
      });
    } else {
      (navigation.navigate as (a: string, b: object) => void)(nested.stack, {
        screen: nested.screen,
      });
    }
    return;
  }
  if (params != null) {
    (navigation.navigate as (a: string, b: object) => void)(name, params);
  } else {
    (navigation.navigate as (a: string) => void)(name);
  }
}

export function openViaRef(name: Leaf, params?: object): void {
  if (!navigationRef.isReady()) return;
  openRootScreen(
    { navigate: navigationRef.navigate.bind(navigationRef) as NavLike['navigate'] },
    name,
    params,
  );
}
