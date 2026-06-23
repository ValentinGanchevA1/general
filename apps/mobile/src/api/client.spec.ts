/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports --
   Each case resets modules so the client's module-level refresh state + the
   axios instance are fresh, then requires the client synchronously with mocks. */

// The session-drop-on-boot regression: a transient refresh failure (timeout /
// offline / 5xx cold-start) must NOT clear tokens or force a logout — only a
// genuine 401/403 from /auth/refresh may. These tests drive the real response
// interceptor by swapping the axios adapter so we can simulate each outcome.

import type { AuthTokens } from '@g88/shared';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/** What the simulated POST /auth/refresh does. */
type RefreshSpec =
  | { kind: 'timeout' } // network/timeout — AxiosError with no `.response`
  | { kind: 'status'; status: number; data?: unknown };

interface Harness {
  api: AxiosInstance;
  authEvents: { on: (e: 'logout', fn: (reason: string) => void) => () => void };
  clear: jest.Mock;
}

const NEW_TOKENS: AuthTokens = {
  accessToken: 'fresh-access',
  refreshToken: 'fresh-refresh',
  expiresAt: '2099-01-01T00:00:00Z',
};

function freshClient(refresh: RefreshSpec): Harness {
  jest.resetModules();
  const clear = jest.fn().mockResolvedValue(undefined);
  jest.doMock('./tokenStore', () => ({
    tokenStore: {
      getAccessToken: jest.fn().mockResolvedValue('expired-access'),
      getRefreshToken: jest.fn().mockResolvedValue('stored-refresh'),
      set: jest.fn().mockResolvedValue(undefined),
      clear,
    },
  }));
  jest.doMock('@/config', () => ({ Config: { API_BASE_URL: 'http://test.local' } }));

  const axiosMod = require('axios');
  const axios = axiosMod.default ?? axiosMod;
  const mod = require('./client');
  const api = mod.api as AxiosInstance;

  // A custom adapter must apply validateStatus itself (built-in adapters call
  // axios' internal `settle`); otherwise a 401 body resolves as success.
  const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> => {
    const response = { data, status, statusText: '', headers: {}, config, request: {} } as AxiosResponse;
    const ok = config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300;
    return ok
      ? Promise.resolve(response)
      : Promise.reject(new axios.AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, undefined, response));
  };

  let mainCalls = 0;
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (config.url?.includes('/auth/refresh')) {
      if (refresh.kind === 'timeout') {
        return Promise.reject(new axios.AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED', config));
      }
      return respond(config, refresh.status, refresh.data ?? {});
    }
    mainCalls += 1;
    // First hit = expired token → 401; retry after a successful refresh → 200.
    return mainCalls === 1
      ? respond(config, 401, { code: 'auth.expired', message: 'expired' })
      : respond(config, 200, { ok: true });
  };

  api.defaults.adapter = adapter;
  // refreshOnce uses the bare `axios.post`, which inherits the default adapter.
  axios.defaults.adapter = adapter;

  return { api, authEvents: mod.authEvents, clear };
}

describe('client refresh interceptor — session-drop-on-boot', () => {
  afterEach(() => jest.clearAllMocks());

  it('keeps tokens and does NOT log out on a transient refresh failure (timeout)', async () => {
    const { api, authEvents, clear } = freshClient({ kind: 'timeout' });
    const onLogout = jest.fn();
    authEvents.on('logout', onLogout);

    await expect(api.get('/auth/me')).rejects.toMatchObject({
      statusCode: 0,
      code: 'refresh_unavailable',
    });
    expect(clear).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('keeps tokens on a 5xx cold-start refresh failure', async () => {
    const { api, authEvents, clear } = freshClient({ kind: 'status', status: 503 });
    const onLogout = jest.fn();
    authEvents.on('logout', onLogout);

    await expect(api.get('/auth/me')).rejects.toMatchObject({ code: 'refresh_unavailable' });
    expect(clear).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('clears tokens and logs out when the refresh token is genuinely rejected (401)', async () => {
    const { api, authEvents, clear } = freshClient({ kind: 'status', status: 401, data: { code: 'auth.invalid' } });
    const onLogout = jest.fn();
    authEvents.on('logout', onLogout);

    await expect(api.get('/auth/me')).rejects.toBeDefined();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledWith('refresh_failed');
  });

  it('refreshes and retries the original request on success', async () => {
    const { api, authEvents, clear } = freshClient({ kind: 'status', status: 200, data: NEW_TOKENS });
    const onLogout = jest.fn();
    authEvents.on('logout', onLogout);

    await expect(api.get('/auth/me')).resolves.toMatchObject({ data: { ok: true } });
    expect(clear).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });
});
