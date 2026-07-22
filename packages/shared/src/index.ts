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
export * from './scrub';

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

export interface DecideIdVerificationDto {
  decision: 'approved' | 'rejected';
  reason?: string;
}

export interface VerificationUpdatedEvent {
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
}
