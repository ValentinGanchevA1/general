import type {
  ListPendingVerificationsDto,
  ListPendingResponseDto,
  AdminVerificationDetailDto,
  DecideIdVerificationDto,
} from '@g88/shared';
import { apiClient } from '@/lib/api-client';

export const adminApi = {
  async listPending(
    dto: ListPendingVerificationsDto,
  ): Promise<ListPendingResponseDto> {
    const { data } = await apiClient.get<ListPendingResponseDto>(
      '/admin/verifications/pending',
      { params: dto },
    );
    return data;
  },

  async getDetail(userId: string): Promise<AdminVerificationDetailDto> {
    const { data } = await apiClient.get<AdminVerificationDetailDto>(
      `/admin/verifications/pending/${userId}`,
    );
    return data;
  },

  async decide(
    userId: string,
    dto: DecideIdVerificationDto,
  ): Promise<{ status: string }> {
    const { data } = await apiClient.post<{ status: string }>(
      `/admin/verifications/pending/${userId}/decide`,
      dto,
    );
    return data;
  },
};
