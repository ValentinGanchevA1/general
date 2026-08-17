import type { UserProfile } from '@g88/shared';

import type { TrustChip } from './TrustStrip';

/** Derive TrustStrip chips from a profile (self or public). */
export function buildTrustChips(profile: UserProfile | null | undefined): TrustChip[] {
  if (!profile) return [];

  const badges = profile.badges ?? {
    email: false,
    phone: false,
    photo: false,
    id: false,
    social: false,
    premium: false,
    verified: false,
  };
  const verificationScore = profile.verificationScore ?? 0;

  const chips: TrustChip[] = [
    {
      id: 'email',
      label: badges.email ? 'Email ✓' : 'Email',
      status: badges.email ? 'success' : 'missing',
    },
  ];

  const idStatus: TrustChip['status'] =
    profile.idVerificationStatus === 'verified'
      ? 'success'
      : profile.idVerificationStatus === 'pending'
        ? 'pending'
        : profile.idVerificationStatus === 'rejected'
          ? 'error'
          : 'missing';

  const idLabel =
    profile.idVerificationStatus === 'verified'
      ? 'ID Verified ✓'
      : profile.idVerificationStatus === 'pending'
        ? 'ID Under review'
        : profile.idVerificationStatus === 'rejected'
          ? 'ID Rejected'
          : 'ID Verification';

  chips.push({ id: 'id', label: idLabel, status: idStatus });
  chips.push({
    id: 'percent',
    label: `${verificationScore}% Verified`,
    status: verificationScore >= 100 ? 'success' : verificationScore > 0 ? 'pending' : 'missing',
  });

  return chips;
}
