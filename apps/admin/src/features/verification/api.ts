// apps/admin/src/features/verification/api.ts
import axios from 'axios';
import {
  ListPendingVerificationsDto,
  ListPendingResponseDto,
  AdminVerificationDetailDto,
  DecideIdVerificationDto,
} from '@g88/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://g88-api.onrender.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor (JWT token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken'); // or from secure cookie / context
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminApi = {
  // List pending verifications
  async listPending(dto: ListPendingVerificationsDto): Promise<ListPendingResponseDto> {
    const response = await api.get('/admin/verifications/pending', {
      params: dto
    });
    return response.data;
  },

  // Get full detail for one verification
  async getDetail(userId: string): Promise<AdminVerificationDetailDto> {
    const response = await api.get(`/admin/verifications/pending/${userId}`);
    return response.data;
  },

  // Make approve/reject decision
  async decide(
    userId: string,
    dto: DecideIdVerificationDto
  ): Promise<any> {
    const response = await api.post(
      `/admin/verifications/pending/${userId}/decide`,
      dto
    );
    return response.data;
  },
};

// Optional: Response type guards or transformers if needed
export const transformVerificationList = (data: ListPendingResponseDto) => {
  return {
    ...data,
    data: data.items.map(item => ({
      ...item,
      submittedAt: new Date(item.submittedAt),
    })),
  };
};
