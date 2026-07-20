export class AdminVerificationDetailDto {
  id: string;
  userId: string;
  displayName: string;
  submittedAt: string;
  selfieUrl: string; // presigned
  idFrontUrl: string; // presigned
  idBackUrl?: string; // presigned (optional)
}
