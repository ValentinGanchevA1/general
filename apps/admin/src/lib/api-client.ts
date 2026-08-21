import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens } from '@g88/shared';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setSession,
  getStoredUser,
} from './auth-storage';

const baseURL =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<AuthTokens>(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    const user = getStoredUser();
    if (user) {
      setSession(user, data);
    } else {
      localStorage.setItem('adminToken', data.accessToken);
      localStorage.setItem('adminRefreshToken', data.refreshToken);
    }
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }

    if (error.response?.status === 401) {
      clearSession();
    }

    return Promise.reject(error);
  },
);
