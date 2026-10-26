/** Public recovery contracts; no account-existence or delivery-channel disclosure. */
export interface ForgotPasswordRequest { email: string }
export interface ForgotPasswordResponse {
  message: string;
  retryAfterSeconds: number;
}
export interface ResetPasswordRequest {
  email: string;
  resetCode: string;
  newPassword: string;
}
export interface ResetPasswordResponse { message: string }
