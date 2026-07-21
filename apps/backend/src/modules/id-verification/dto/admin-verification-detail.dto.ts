export interface AdminVerificationDetailDto {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
  selfieUrl: string;
  idFrontUrl: string;
  idBackUrl: string | null;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
