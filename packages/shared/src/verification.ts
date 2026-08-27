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
