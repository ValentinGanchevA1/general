import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { AuthTokens, ApiError } from '@g88/shared';

import { tokenStore } from './tokenStore';
import { Config } from '@/config';

/**
 * Centralized HTTP client.
 *
 * Behaviors:
 *  1. Injects the access token on every request.
 *  2. On 401, attempts a single refresh, then retries the original request.
 *  3. Concurrent 401s share a single in-flight refresh promise (no thundering herd).
 *  4. If refresh itself fails, clears tokens and broadcasts a logout event.
 */

let refreshInFlight: Promise<AuthTokens | null> | null = null;

export const api: AxiosInstance = axios.create({
  baseURL: `${Config.API_BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
  const token = await tokenStore.getAccessToken();
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true;
      const tokens = await refreshOnce();
      if (tokens && original.headers) {
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api.request(original);
      }
      tokenStore.clear();
      authEvents.emit('logout', 'refresh_failed');
    }
    return Promise.reject(normalizeError(err));
  },
);

async function refreshOnce(): Promise<AuthTokens | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) return null;
      const res = await axios.post<AuthTokens>(
        `${Config.API_BASE_URL}/api/v1/auth/refresh`,
        { refreshToken },
        { timeout: 10_000 },
      );
      await tokenStore.set(res.data);
      return res.data;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/signup');
}

function normalizeError(err: unknown): ApiError {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Partial<ApiError>;
    return {
      statusCode: err.response.status,
      code: data.code ?? 'unknown',
      message: data.message ?? err.message,
      details: data.details,
    };
  }
  return {
    statusCode: 0,
    code: 'network',
    message: err instanceof Error ? err.message : 'Network error',
  };
}

// Tiny event bus so screens/navigation can react to forced logout.
type AuthEvent = 'logout';
class AuthEvents {
  private listeners = new Map<AuthEvent, Set<(reason: string) => void>>();
  emit(e: AuthEvent, reason: string) {
    this.listeners.get(e)?.forEach((fn) => fn(reason));
  }
  on(e: AuthEvent, fn: (reason: string) => void): () => void {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e)!.add(fn);
    return () => this.listeners.get(e)!.delete(fn);
  }
}
export const authEvents = new AuthEvents();

// Typed convenience wrappers for the discovery + interaction endpoints.

export async function postJson<TReq, TRes>(
  path: string,
  body: TReq,
  config?: AxiosRequestConfig,
): Promise<TRes> {
  const res = await api.post<TRes>(path, body, config);
  return res.data;
}

export async function getJson<TRes>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<TRes> {
  const res = await api.get<TRes>(path, config);
  return res.data;
}
