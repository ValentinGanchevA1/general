/**
 * Pure mappers: API / slice shapes → ProfileViewModel.
 * No React, no side effects — unit-testable.
 */
import {
  formatPublicIdentityParts,
  type Gender,
  type PublicUserProfile,
  type RelationshipSummary,
  type SexualOrientation,
  type UserProfile,
} from '@g88/shared';

import type { ProfileViewModel } from '@/components/Profile/profileView.types';

export type MapPublicOptions = {
  rel: RelationshipSummary | null;
  friendLabel: string;
  /** Override when screen already computed blocked. */
  blocked?: boolean;
  /** Subscription not on public profile today. */
  isPaid?: boolean;
  tierLabel?: string | null;
};

/**
 * Map GET /users/:id + relationship into the shared view model.
 * Identity fields are already server-gated by show_*.
 */

/** Shared identity + hometown lines (server already gates by show_*). */
export function publicIdentityLines(p: {
  gender?: Gender | null;
  genderSelfDescribe?: string | null;
  sexualOrientation?: SexualOrientation | null;
  orientationSelfDescribe?: string | null;
  nationality?: string | null;
  hometownCity?: string | null;
  hometownCountry?: string | null;
}): { identityLine: string | null; hometownLine: string | null } {
  const identityLine =
    formatPublicIdentityParts({
      gender: p.gender ?? null,
      genderSelfDescribe: p.genderSelfDescribe ?? null,
      sexualOrientation: p.sexualOrientation ?? null,
      orientationSelfDescribe: p.orientationSelfDescribe ?? null,
      nationality: p.nationality ?? null,
    }).join(' · ') || null;

  const hometownLine =
    [p.hometownCity, p.hometownCountry].filter(Boolean).join(', ') || null;

  return { identityLine, hometownLine };
}

export function mapPublicToViewModel(
  p: PublicUserProfile,
  opts: MapPublicOptions,
): ProfileViewModel {
  const { rel, friendLabel, blocked, isPaid = false, tierLabel = null } = opts;

  const { identityLine, hometownLine } = publicIdentityLines(p);

  const status = p.status
    ? {
        level: p.status.level ?? null,
        allTimeRank: p.status.allTimeRank ?? null,
        achievementIcons: p.status.achievementIcons ?? [],
      }
    : null;

  return {
    userId: p.id,
    displayName: p.displayName,
    age: p.age ?? null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    photoUrls: p.photoUrls ?? [],
    bio: p.bio ?? null,
    interests: [],
    goals: p.goals ?? [],
    identityLine,
    hometownLine: hometownLine || null,
    verification: p.verification,
    idVerified: p.idVerified === true,
    verificationScore: p.verificationScore ?? null,
    online: p.online === true,
    distanceMeters: p.distanceMeters ?? null,
    status,
    isPaid,
    tierLabel,
    mutualFriendsCount: rel?.mutualFriendsCount ?? 0,
    isFollowing: rel?.isFollowing ?? false,
    friendState: rel?.state ?? 'none',
    friendLabel,
    blocked: blocked ?? p.blockedByViewer === true,
    canMessage: p.relationship?.canMessage ?? 'none',
    matched: p.relationship?.matched === true,
  };
}

export type MapSelfOptions = {
  /** Photos already resolved (gallery or avatar fallback). */
  photoUrls: string[];
  tierLabel: string | null;
  isPaid: boolean;
  mapVisible: boolean;
};

/**
 * Map owner UserProfile into ProfileViewModel.
 * Applies show_* gates the same way ProfileScreen does today.
 */
export function mapSelfToViewModel(
  p: UserProfile,
  opts: MapSelfOptions,
): ProfileViewModel {
  const identityLine =
    formatPublicIdentityParts({
      gender: p.showGender ? p.gender : null,
      genderSelfDescribe: p.showGender ? p.genderSelfDescribe : null,
      sexualOrientation: p.showOrientation ? p.sexualOrientation : null,
      orientationSelfDescribe: p.showOrientation ? p.orientationSelfDescribe : null,
      nationality: p.showNationality ? p.nationality : null,
    }).join(' · ') || null;

  const hometownLine =
    p.showHometown && (p.hometownCity || p.hometownCountry)
      ? [p.hometownCity, p.hometownCountry].filter(Boolean).join(', ')
      : null;

  return {
    userId: p.id,
    displayName: p.displayName,
    age: p.showAge ? p.age : null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    photoUrls: opts.photoUrls,
    bio: p.bio ?? null,
    interests: p.interests ?? [],
    goals: p.goals ?? [],
    identityLine,
    hometownLine,
    verification: p.verification,
    idVerified: p.idVerificationStatus === 'verified' || p.badges?.id === true,
    verificationScore: p.verificationScore ?? null,
    online: false,
    distanceMeters: null,
    status: null,
    isPaid: opts.isPaid,
    tierLabel: opts.tierLabel,
    mapVisible: opts.mapVisible,
  };
}

/** Friend-row label matching useUserProfileScreenData. */
export function friendLabelFromRel(rel: RelationshipSummary | null): string {
  const state = rel?.state ?? 'none';
  if (state === 'friends') return 'Friends';
  if (state === 'request_outgoing') return 'Requested';
  if (state === 'request_incoming') return 'Accept';
  return 'Add friend';
}
