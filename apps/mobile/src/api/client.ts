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

/**
 * Result of a refresh attempt. `authFailed` distinguishes a genuine rejection
 * (the refresh token is invalid/expired/revoked → 401/403, must re-auth) from a
 * transient failure (timeout, offline, or a 5xx cold-start) where the tokens are
 * still valid and must be preserved for a later retry.
 */
type RefreshOutcome =
  | { ok: true; tokens: AuthTokens }
  | { ok: false; authFailed: boolean };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

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
      const outcome = await refreshOnce();
      if (outcome.ok) {
        if (original.headers) {
          original.headers.Authorization = `Bearer ${outcome.tokens.accessToken}`;
        }
        return api.request(original);
      }
      if (outcome.authFailed) {
        // Refresh token is genuinely invalid → end the session.
        tokenStore.clear();
        authEvents.emit('logout', 'refresh_failed');
        return Promise.reject(normalizeError(err));
      }
      // Transient refresh failure (timeout / offline / 5xx cold-start): keep the
      // tokens and surface a network-style error so callers (e.g. restoreSession)
      // don't mistake the original 401 for an auth failure and wipe the session.
      const transient: ApiError = {
        statusCode: 0,
        code: 'refresh_unavailable',
        message: 'Could not reach the server to refresh your session. Please try again.',
      };
      return Promise.reject(transient);
    }
    return Promise.reject(normalizeError(err));
  },
);

async function refreshOnce(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      // No stored refresh token → nothing to refresh; the user must re-auth.
      if (!refreshToken) return { ok: false, authFailed: true };
      const res = await axios.post<AuthTokens>(
        `${Config.API_BASE_URL}/api/v1/auth/refresh`,
        { refreshToken },
        { timeout: 10_000 },
      );
      await tokenStore.set(res.data);
      return { ok: true, tokens: res.data };
    } catch (e) {
      // 401/403 → the refresh token is genuinely invalid (log out). Anything else
      // (timeout, network, 5xx cold-start) is transient → keep the tokens.
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      return { ok: false, authFailed: status === 401 || status === 403 };
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/register') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/oauth/')
  );
}

function normalizeError(err: unknown): ApiError {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Partial<ApiError>;
    return {
      statusCode: err.response.status,
      code: data.code ?? 'unknown',
      message: data.message ?? err.message,
      ...(data.details !== undefined ? { details: data.details } : {}),
    };
  }
  return {
    statusCode: 0,
    code: 'network',
    message: err instanceof Error ? err.message : 'Network error',
  };
}

// Tiny event bus so the navigator can react to forced logout.
type AuthEvent = 'logout';
class AuthEvents {
  private listeners = new Map<AuthEvent, Set<(reason: string) => void>>();
  emit(e: AuthEvent, reason: string): void {
    this.listeners.get(e)?.forEach((fn) => fn(reason));
  }
  on(e: AuthEvent, fn: (reason: string) => void): () => void {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e)!.add(fn);
    return () => this.listeners.get(e)!.delete(fn);
  }
}
export const authEvents = new AuthEvents();

// ─── Typed convenience wrappers ──────────────────────────────────────────────

export async function getJson<TRes>(path: string, config?: AxiosRequestConfig): Promise<TRes> {
  const res = await api.get<TRes>(path, config);
  return res.data;
}

export async function postJson<TReq, TRes>(
  path: string,
  body: TReq,
  config?: AxiosRequestConfig,
): Promise<TRes> {
  const res = await api.post<TRes>(path, body, config);
  return res.data;
}

export async function patchJson<TReq, TRes>(
  path: string,
  body: TReq,
  config?: AxiosRequestConfig,
): Promise<TRes> {
  const res = await api.patch<TRes>(path, body, config);
  return res.data;
}

export async function putJson<TReq, TRes>(
  path: string,
  body: TReq,
  config?: AxiosRequestConfig,
): Promise<TRes> {
  const res = await api.put<TRes>(path, body, config);
  return res.data;
}

export async function deleteJson<TRes>(path: string, config?: AxiosRequestConfig): Promise<TRes> {
  const res = await api.delete<TRes>(path, config);
  return res.data;
}
