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
