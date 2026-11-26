export interface UgcTermsAcceptanceStatus {
  required: boolean;
  accepted: boolean;
  termsVersion: string | null;
  termsSha256: string | null;
  acceptedAt: string | null;
}

export interface AcceptUgcTermsRequest {
  accepted: boolean;
  termsVersion: string;
  termsSha256: string;
}
