import type { IdVerificationStatus, VerificationLevel } from './api';

/** Email ownership OTP types (story soft-gate / badge ladder). */
export interface StartEmailVerificationResponse {
  sent: boolean;
  /** 'email' when Twilio sent; 'dev' when local fixed code is used. */
  channel: 'email' | 'dev';
  /** Masked destination for UI, e.g. v***@gmail.com */
  maskedEmail: string;
}

export interface CheckEmailVerificationRequest {
  /** 6-digit OTP. */
  code: string;
}

/**
 * Product ladder (2026-08):
 *   none → email → phone → id
 * Selfie is NOT a distinct step — it is required media inside the ID submit flow.
 * `verification_level` may still hold legacy 'selfie' rows; treat as intermediate toward id.
 */
export type VerificationLadderStep = 'email' | 'phone' | 'id';

export interface VerificationLadderStatus {
  /** Current badge ladder level from users.verification_level. */
  level: VerificationLevel;
  /** Parallel ID review status (none | pending | verified | rejected). */
  idStatus: IdVerificationStatus;
  /** Next actionable step for the client, or null when fully done. */
  nextStep: VerificationLadderStep | null;
  canStartEmail: boolean;
  canStartPhone: boolean;
  /** True when user may start/submit ID (not already verified or pending). */
  canStartId: boolean;
  /** Short copy for UI nudge. */
  message: string;
}

/** Client/server-shared next trust action (Profile card, map nudge, Settings). */
export type TrustNextKind = 'actionable' | 'pending' | 'done';

export type TrustNextNav = 'EmailVerification' | 'Verification' | 'VerificationId';

export interface TrustNextStep {
  /** Ladder step when there is something to do; null when pending or done. */
  step: VerificationLadderStep | null;
  kind: TrustNextKind;
  title: string;
  detail: string;
  ctaLabel: string | null;
  /** Mobile navigation leaf (openRootScreen / stack). */
  nav: TrustNextNav | null;
}

/**
 * Single source of truth for "what should the user do next on the trust ladder?"
 * Mirrors GET /verification/status nextStep semantics without network.
 */
export function resolveTrustNextStep(input: {
  emailVerified: boolean;
  phoneVerified: boolean;
  idStatus?: IdVerificationStatus | null | undefined;
}): TrustNextStep {
  if (!input.emailVerified) {
    return {
      step: 'email',
      kind: 'actionable',
      title: 'Verify email',
      detail: 'Unlock stories and raise trust',
      ctaLabel: 'Verify email',
      nav: 'EmailVerification',
    };
  }
  if (!input.phoneVerified) {
    return {
      step: 'phone',
      kind: 'actionable',
      title: 'Add phone',
      detail: 'Stronger identity for higher-stakes actions',
      ctaLabel: 'Add phone',
      nav: 'Verification',
    };
  }

  const id = input.idStatus ?? 'none';
  if (id === 'verified') {
    return {
      step: null,
      kind: 'done',
      title: 'Fully verified',
      detail: 'Email · Phone · ID complete',
      ctaLabel: null,
      nav: null,
    };
  }
  if (id === 'pending') {
    return {
      step: null,
      kind: 'pending',
      title: 'ID under review',
      detail: 'Usually finishes within 24h',
      ctaLabel: null,
      nav: null,
    };
  }
  if (id === 'rejected') {
    return {
      step: 'id',
      kind: 'actionable',
      title: 'Resubmit ID',
      detail: 'Previous submission was rejected',
      ctaLabel: 'Resubmit',
      nav: 'VerificationId',
    };
  }
  return {
    step: 'id',
    kind: 'actionable',
    title: 'Verify ID',
    detail: 'Unlock the full trust badge',
    ctaLabel: 'Verify ID',
    nav: 'VerificationId',
  };
}
