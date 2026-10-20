import type { UserProfile } from '@g88/shared';

import type { TrustChip } from './TrustStrip';

/** Derive explicit identity-signal chips from a profile (self or public). */
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

  const chips: TrustChip[] = [
    {
      id: 'email',
      label: badges.email ? 'Email verified' : 'Email',
      status: badges.email ? 'success' : 'missing',
    },
    {
      id: 'phone',
      label: badges.phone ? 'Phone verified' : 'Phone',
      status: badges.phone ? 'success' : 'missing',
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
      ? 'ID verified'
      : profile.idVerificationStatus === 'pending'
        ? 'ID under review'
        : profile.idVerificationStatus === 'rejected'
          ? 'ID needs attention'
          : 'ID verification';

  chips.push({ id: 'id', label: idLabel, status: idStatus });

  const socialConnected = badges.social === true || (profile.socialLinks?.length ?? 0) > 0;
  if (socialConnected) {
    chips.push({ id: 'social', label: 'Profile connected', status: 'success' });
  }

  return chips;
}
