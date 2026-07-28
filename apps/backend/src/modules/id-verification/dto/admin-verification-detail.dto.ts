export type RekognitionAssistStatus =
  | 'skipped'
  | 'ok'
  | 'no_face_selfie'
  | 'no_face_id'
  | 'error';

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
  /** CompareFaces best similarity 0–100; null if not run or no match. */
  faceSimilarity: number | null;
  selfieFaceCount: number | null;
  idFrontFaceCount: number | null;
  selfieFaceConfidence: number | null;
  idFrontFaceConfidence: number | null;
  rekognitionStatus: RekognitionAssistStatus;
  rekognitionError: string | null;
  rekognitionAt: string | null;
}
