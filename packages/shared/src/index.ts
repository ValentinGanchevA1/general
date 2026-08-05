export * from './geo';
export * from './api';
export * from './events';
export * from './event';
export * from './listing';
export * from './notifications';
export * from './activity';
export * from './gamification';
export * from './challenges';
export * from './achievements';
export * from './gifts';
export * from './story';
export * from './scrub';
export * from './verification';

export interface PendingVerificationSummary {
  id: string;
  userId: string;
  submittedAt: string;
}

export interface ListPendingVerificationsDto {
  page?: number;
  limit?: number;
}

export interface ListPendingResponseDto {
  items: PendingVerificationSummary[];
  page: number;
  limit: number;
  total: number;
}

export type RekognitionAssistStatus =
  | 'skipped'
  | 'ok'
  | 'no_face_selfie'
  | 'no_face_id'
  | 'error';

export interface AdminVerificationDetailDto {
  id: string;
  userId: string;
  submittedAt: string;
  selfieUrl: string;
  idDocumentUrl: string;
  status: 'pending' | 'verified' | 'rejected';
  rekognitionStatus?: RekognitionAssistStatus;
  rekognitionSimilarity?: number | null;
  rekognitionNotes?: string | null;
}

export interface DecideVerificationDto {
  status: 'verified' | 'rejected';
  reason?: string;
}

export interface VerificationUpdatedEvent {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
}
