export type IdVerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  // ... existing fields
  idVerificationStatus: IdVerificationStatus;
  verifiedBadge: boolean;           // derived: idVerificationStatus === 'verified'
  verificationScore: number;        // existing field — we will increment on approval
}

export interface StartIdVerificationResponse {
  selfieUploadUrl: string;
  idFrontUploadUrl: string;
  idBackUploadUrl?: string;         // optional for v1
  expiresIn: number;
}

export interface SubmitIdVerificationRequest {
  selfieKey: string;
  idFrontKey: string;
  idBackKey?: string;
}

export interface IdVerificationStatusResponse {
  status: IdVerificationStatus;
  verifiedAt?: string;
  rejectionReason?: string;
}
