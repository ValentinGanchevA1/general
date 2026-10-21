import type { MessagePermission } from '@g88/shared';

import { resolveNexaConnectActionLabel } from '@/product/nexaActionLanguage';

export type UserPrimaryCtaKind = 'loading' | 'none' | 'message' | 'wave';

export type UserPrimaryCta = {
  kind: UserPrimaryCtaKind;
  /** Button label when kind is message or wave. */
  label: string;
};

export type ResolveUserPrimaryCtaInput = {
  /** False while public profile / relationship still loading. */
  relationshipKnown: boolean;
  blocked?: boolean;
  canMessage?: MessagePermission | null;
  matched?: boolean;
  /** False when wave is not offered (e.g. no onWave handler). */
  waveAvailable?: boolean;
};

/**
 * Single primary CTA for user surfaces (map sheet, UserProfile).
 * Message when chat unlocked or matched; else Wave; loading/none otherwise.
 * Inbox Activity stays signal-driven (Match / Accept / Follow back) — not this helper.
 */
export function resolveUserPrimaryCta(
  input: ResolveUserPrimaryCtaInput,
): UserPrimaryCta {
  const {
    relationshipKnown,
    blocked = false,
    canMessage = 'none',
    matched = false,
    waveAvailable = true,
  } = input;

  if (!relationshipKnown) {
    return { kind: 'loading', label: '' };
  }
  if (blocked) {
    return { kind: 'none', label: '' };
  }

  const messageAllowed = canMessage != null && canMessage !== 'none';
  if ((canMessage === 'chat' || matched) && messageAllowed) {
    return { kind: 'message', label: resolveNexaConnectActionLabel('message') };
  }
  if (waveAvailable) {
    return { kind: 'wave', label: resolveNexaConnectActionLabel('wave') };
  }
  return { kind: 'none', label: '' };
}
