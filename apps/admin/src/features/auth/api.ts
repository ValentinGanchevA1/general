import axios from 'axios';
import type { LoginRequest, LoginResponse } from '@g88/shared';
import { apiClient } from '@/lib/api-client';
import { getRefreshToken } from '@/lib/auth-storage';

const baseURL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/** Login uses a bare client so a bad token never blocks the form. */
export async function loginAdmin(dto: LoginRequest): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(`${baseURL}/auth/login`, dto, {
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

export async function logoutAdmin(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  try {
    await apiClient.post('/auth/logout', { refreshToken });
  } catch {
    // Best-effort — session is cleared client-side regardless
  }
}
