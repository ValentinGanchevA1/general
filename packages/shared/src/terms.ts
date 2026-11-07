/** Terms acceptance is an affirmative, version-specific user action. */
export interface TermsStatusResponse {
  configured: boolean;
  enforcementEnabled: boolean;
  version: string | null;
  url: string | null;
  accepted: boolean;
  required: boolean;
}
export interface AcceptTermsRequest { version: string; accepted: true; channel: 'mobile' | 'web' | 'api' }
export interface AcceptTermsResponse { accepted: true; version: string; acceptedAt: string }
