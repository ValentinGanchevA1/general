/**
 * Shared presentational contract for ProfileScreen (self) and UserProfileScreen (other).
 */
import type { ReactElement, ReactNode } from 'react';
import type { RefreshControlProps } from 'react-native';
import type { MessagePermission, VerificationLevel } from '@g88/shared';
import type { RelationshipState } from '@g88/shared';
import type { UserPrimaryCta } from '@/features/social/resolveUserPrimaryCta';

export type ProfileFocusSection =
  | 'trust'
  | 'stats'
  | 'storyline'
  | 'photos'
  | 'bio'
  | 'mutual';

/** Normalized fields both modes can feed into ProfileView. */
export type ProfileViewModel = {
  userId: string;
  displayName: string;
  /** Age when public / owner-visible; null when hidden or unset. */
  age: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  photoUrls: string[];
  bio: string | null;
  interests: string[];
  goals: string[];
  /** Pre-formatted via formatPublicIdentityParts (opted-in fields only). */
  identityLine: string | null;
  hometownLine: string | null;
  verification: VerificationLevel;
  idVerified: boolean;
  /** Raw score; UI uses formatTrustScoreLabel (0 → —). */
  verificationScore: number | null;
  online: boolean;
  distanceMeters: number | null;
  status: {
    level: number | null;
    allTimeRank: number | null;
    achievementIcons: string[];
  } | null;
  isPaid: boolean;
  tierLabel: string | null;
  /** Self only — map visibility. */
  mapVisible?: boolean;
  /** Other only — social graph. */
  mutualFriendsCount?: number;
  isFollowing?: boolean;
  friendState?: RelationshipState;
  friendLabel?: string;
  blocked?: boolean;
  canMessage?: MessagePermission;
  matched?: boolean;
};

export type ProfileViewActions = {
  onBack?: () => void;
  onPressSettings?: () => void;
  onPressMenu?: () => void;
  onPressVerificationBadge?: () => void;

  onPressPhoto?: () => void;
  onSelectPhotoIndex?: (index: number) => void;
  onPressIdentityPreview?: () => void;
  onPressVisibility?: () => void;
  onPressViewOnMap?: () => void;
  onPressMutual?: () => void;

  onPrimaryCta?: () => void;
  onFollowToggle?: () => void;
  onFriendAction?: () => void;

  onPressPhotosManage?: () => void;
  onPressPremium?: () => void;
  onPressFriends?: () => void;
  onPressSuggestions?: () => void;
  onPressChallenges?: () => void;
  onPressLeaderboard?: () => void;
  onPressAchievements?: () => void;
  onPressGifts?: () => void;
  onPressMarketplace?: () => void;

  onTrustContinue?: (id: 'email' | 'phone' | 'id') => void;
  onOpenTrustDetails?: () => void;
};

/**
 * Self-only blocks that still depend on UserProfile / Redux slices.
 * Keeps ProfileViewModel free of owner DTOs; screen owns composition.
 */
export type ProfileViewSelfSlots = {
  trustNext?: ReactNode;
  activity?: ReactNode;
  friends?: ReactNode;
  premium?: ReactNode;
};

export type ProfileViewProps = {
  mode: 'self' | 'other';
  profile: ProfileViewModel;
  actions: ProfileViewActions;

  primaryCta?: UserPrimaryCta;
  waving?: boolean;
  messaging?: boolean;
  followBusy?: boolean;
  friendBusy?: boolean;

  /** Self activity strip (also available via selfSlots.activity). */
  gamification?: unknown;
  challenges?: unknown;
  spendableXp?: number;
  pendingFriendCount?: number;

  /** Self-only opaque slots (TrustNextCard, ActivityLinks, Friends, Premium). */
  selfSlots?: ProfileViewSelfSlots;

  /** Pull-to-refresh (self ProfileScreen). */
  refreshControl?: ReactElement<RefreshControlProps>;

  focus?: ProfileFocusSection;
  activePhotoIndex?: number;

  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
};
