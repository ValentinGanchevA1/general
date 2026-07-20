export class PendingVerificationSummaryDto {
  id: string;
  userId: string;
  displayName: string;
  submittedAt: string;
}

export class ListPendingResponseDto {
  data: PendingVerificationSummaryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
