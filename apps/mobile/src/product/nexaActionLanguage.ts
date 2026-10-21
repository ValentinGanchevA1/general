import type {
  IdVerificationStatus,
  RsvpStatus,
  TrustNextStep,
  VerificationLadderStep,
} from '@g88/shared';

export type NexaActionIntent =
  | 'discover'
  | 'connect'
  | 'join'
  | 'offer'
  | 'verify'
  | 'retry';

export type NexaActionEmphasis = 'discovery' | 'primary' | 'secondary';

export interface NexaActionLanguageEntry {
  label: string;
  pendingLabel: string;
  completedLabel?: string;
  emphasis: NexaActionEmphasis;
}

/**
 * Canonical NEXA action verbs.
 *
 * These are product-language semantics, not backend operations. Feature code
 * may use a more specific variant (Wave, Message, Send counter) while keeping
 * the same intent and outcome boundary.
 */
export const NEXA_ACTION_LANGUAGE: Readonly<Record<NexaActionIntent, NexaActionLanguageEntry>> = {
  discover: {
    label: 'Discover nearby',
    pendingLabel: 'Discovering…',
    emphasis: 'discovery',
  },
  connect: {
    label: 'Connect',
    pendingLabel: 'Connecting…',
    emphasis: 'primary',
  },
  join: {
    label: 'Join',
    pendingLabel: 'Joining…',
    completedLabel: 'Going',
    emphasis: 'primary',
  },
  offer: {
    label: 'Send offer',
    pendingLabel: 'Sending offer…',
    completedLabel: 'Offer sent',
    emphasis: 'primary',
  },
  verify: {
    label: 'Verify',
    pendingLabel: 'Verifying…',
    completedLabel: 'Verified',
    emphasis: 'primary',
  },
  retry: {
    label: 'Try again',
    pendingLabel: 'Retrying…',
    emphasis: 'secondary',
  },
} as const;

export type NexaConnectVariant = 'connect' | 'wave' | 'message' | 'profile';

export function resolveNexaConnectActionLabel(variant: NexaConnectVariant): string {
  switch (variant) {
    case 'wave':
      return 'Wave';
    case 'message':
      return 'Message';
    case 'profile':
      return 'Connect profile';
    case 'connect':
      return NEXA_ACTION_LANGUAGE.connect.label;
  }
}

export function resolveNexaRsvpActionLabel(status: RsvpStatus, active: boolean): string {
  switch (status) {
    case 'going':
      return active ? (NEXA_ACTION_LANGUAGE.join.completedLabel ?? 'Going') : NEXA_ACTION_LANGUAGE.join.label;
    case 'maybe':
      return 'Maybe';
    case 'declined':
      return "Can't go";
  }
}

export type NexaOfferActionStage =
  | 'start'
  | 'submit'
  | 'counter'
  | 'accept'
  | 'decline'
  | 'withdraw';

export function resolveNexaOfferActionLabel(stage: NexaOfferActionStage): string {
  switch (stage) {
    case 'start':
      return 'Make offer';
    case 'submit':
      return NEXA_ACTION_LANGUAGE.offer.label;
    case 'counter':
      return 'Send counter';
    case 'accept':
      return 'Accept offer';
    case 'decline':
      return 'Decline offer';
    case 'withdraw':
      return 'Withdraw offer';
  }
}

export type NexaVerifyMode = 'start' | 'retry';

export function resolveNexaVerifyActionLabel(
  step: VerificationLadderStep,
  mode: NexaVerifyMode = 'start',
): string {
  if (mode === 'retry' && step === 'id') return 'Try identity verification again';

  switch (step) {
    case 'email':
      return 'Verify email';
    case 'phone':
      return 'Verify phone';
    case 'id':
      return 'Verify identity';
  }
}

export function resolveNexaTrustActionLabel(
  next: TrustNextStep,
  idStatus?: IdVerificationStatus | null,
): string | null {
  if (next.kind !== 'actionable' || next.step == null) return null;
  return resolveNexaVerifyActionLabel(
    next.step,
    next.step === 'id' && idStatus === 'rejected' ? 'retry' : 'start',
  );
}

export type NexaRetryScope = 'generic' | 'discovery' | 'event' | 'listing' | 'profile';

export function resolveNexaRetryActionLabel(scope: NexaRetryScope = 'generic'): string {
  switch (scope) {
    case 'discovery':
      return 'Retry discovery';
    case 'profile':
      return 'Retry profile';
    case 'event':
    case 'listing':
    case 'generic':
      return NEXA_ACTION_LANGUAGE.retry.label;
  }
}
