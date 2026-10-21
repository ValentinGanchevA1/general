export interface NexaProfileIdentitySource {
  hometownCity?: string | null | undefined;
  hometownCountry?: string | null | undefined;
  interests?: readonly string[] | null | undefined;
}

export interface NexaProfileTrustState {
  email: boolean;
  phone: boolean;
  id: boolean;
}

export interface NexaProfileActivityState {
  level?: number | null | undefined;
  currentStreak?: number | null | undefined;
}

export type NexaProfileSectionKey = 'identity' | 'presence' | 'activity' | 'account';

export const NEXA_PROFILE_SECTION_LABELS: Record<NexaProfileSectionKey, string> = {
  identity: 'Identity',
  presence: 'Presence',
  activity: 'Activity',
  account: 'Account',
};

export function buildNexaProfileIdentityLine(source: NexaProfileIdentitySource): string {
  const parts: string[] = [];
  const home = source.hometownCity?.trim() || source.hometownCountry?.trim();
  if (home) parts.push(home);

  for (const raw of source.interests ?? []) {
    const interest = raw.trim();
    if (!interest || parts.includes(interest)) continue;
    parts.push(interest);
    if (parts.length >= 3) break;
  }

  return parts.join(' · ');
}

export function countVerifiedProfileSignals(state: NexaProfileTrustState): number {
  return Number(state.email) + Number(state.phone) + Number(state.id);
}

export function formatNexaProfileTrustSummary(state: NexaProfileTrustState): string {
  const verified = countVerifiedProfileSignals(state);
  if (verified === 3) return 'Email, phone and ID verified';
  if (verified === 0) return 'No verification signals completed';
  return `${verified} of 3 verification signals completed`;
}

export function formatNexaProfileActivitySummary(state: NexaProfileActivityState): string | null {
  const level = Number.isFinite(state.level) ? Math.max(0, Math.floor(state.level ?? 0)) : null;
  const streak = Number.isFinite(state.currentStreak)
    ? Math.max(0, Math.floor(state.currentStreak ?? 0))
    : 0;

  if (level == null && streak === 0) return null;

  const parts: string[] = [];
  if (level != null) parts.push(`Level ${level}`);
  if (streak > 0) parts.push(`${streak} day${streak === 1 ? '' : 's'} streak`);
  return parts.join(' · ');
}
