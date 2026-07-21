export interface PendingVerificationSummary {
  id: string;
  userId: string;
  submittedAt: string;
}

export interface ListPendingResponseDto {
  items: PendingVerificationSummary[];
  page: number;
  limit: number;
  total: number;
}
