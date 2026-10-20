import type { IdVerificationStatus, UserProfile } from '@g88/shared';

export type NexaTrustLevel = 'basic' | 'contact' | 'identity' | 'trusted';

export interface NexaTrustSignals {
  emailVerified: boolean;
  phoneVerified: boolean;
  idStatus?: IdVerificationStatus | null | undefined;
  idBadgeVerified?: boolean | undefined;
  legacyVerifiedBadge?: boolean | undefined;
  socialConnected: boolean;
}

export interface NexaTrustVisual {
  level: NexaTrustLevel;
  label: string;
  detail: string;
  identityVerified: boolean;
  socialConnected: boolean;
  completedSignals: number;
  totalSignals: 4;
}

export function trustSignalsFromProfile(
  profile: UserProfile | null | undefined,
): NexaTrustSignals {
  return {
    emailVerified: profile?.badges?.email === true,
    phoneVerified: profile?.badges?.phone === true,
    idStatus: profile?.idVerificationStatus,
    idBadgeVerified: profile?.badges?.id === true,
    legacyVerifiedBadge: profile?.verifiedBadge === true,
    socialConnected:
      profile?.badges?.social === true || (profile?.socialLinks?.length ?? 0) > 0,
  };
}

export function resolveNexaTrustVisual(signals: NexaTrustSignals): NexaTrustVisual {
  const identityVerified =
    signals.idStatus === 'verified' ||
    signals.idBadgeVerified === true ||
    signals.legacyVerifiedBadge === true;
  const contactVerified = signals.emailVerified && signals.phoneVerified;
  const completedSignals =
    Number(signals.emailVerified) +
    Number(signals.phoneVerified) +
    Number(identityVerified) +
    Number(signals.socialConnected);

  if (identityVerified && contactVerified && signals.socialConnected) {
    return {
      level: 'trusted',
      label: 'Trusted profile',
      detail: 'Core identity is verified and a supporting profile is connected.',
      identityVerified,
      socialConnected: true,
      completedSignals,
      totalSignals: 4,
    };
  }

  if (identityVerified) {
    return {
      level: 'identity',
      label: 'Identity verified',
      detail: signals.socialConnected
        ? 'Government ID is verified with an additional connected-profile signal.'
        : 'Government ID is verified. Connected profiles are an optional supporting signal.',
      identityVerified,
      socialConnected: signals.socialConnected,
      completedSignals,
      totalSignals: 4,
    };
  }

  if (contactVerified) {
    return {
      level: 'contact',
      label: 'Contact verified',
      detail: 'Email and phone are verified. Government ID is the next identity step.',
      identityVerified: false,
      socialConnected: signals.socialConnected,
      completedSignals,
      totalSignals: 4,
    };
  }

  return {
    level: 'basic',
    label: 'Basic profile',
    detail: 'Verify contact details to start building stronger identity signals.',
    identityVerified: false,
    socialConnected: signals.socialConnected,
    completedSignals,
    totalSignals: 4,
  };
}

export function resolveNexaTrustVisualFromProfile(
  profile: UserProfile | null | undefined,
): NexaTrustVisual {
  return resolveNexaTrustVisual(trustSignalsFromProfile(profile));
}
