import { useCallback, useEffect, useState } from 'react';
import type { AuthenticatedUser, LoginRequest } from '@g88/shared';
import {
  AUTH_CHANGED_EVENT,
  clearSession,
  getAccessToken,
  getStoredUser,
  setSession,
} from '@/lib/auth-storage';
import { loginAdmin, logoutAdmin } from './api';

interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  isLoggingIn: boolean;
  loginError: string | null;
}

function readState(): Pick<AuthState, 'isAuthenticated' | 'user'> {
  const token = getAccessToken();
  return {
    isAuthenticated: Boolean(token),
    user: token ? getStoredUser() : null,
  };
}

export function useAuth() {
  const initial = readState();
  const [isAuthenticated, setIsAuthenticated] = useState(initial.isAuthenticated);
  const [user, setUser] = useState<AuthenticatedUser | null>(initial.user);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = readState();
      setIsAuthenticated(next.isAuthenticated);
      setUser(next.user);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const login = useCallback(async (dto: LoginRequest) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await loginAdmin(dto);
      setSession(res.user, res.tokens);
      setIsAuthenticated(true);
      setUser(res.user);
      return res;
    } catch (err: unknown) {
      const message =
        axiosErrorMessage(err) ?? 'Login failed. Check email/password and backend.';
      setLoginError(message);
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      clearSession();
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  return {
    isAuthenticated,
    user,
    isLoggingIn,
    loginError,
    login,
    logout,
    clearLoginError: () => setLoginError(null),
  };
}

function axiosErrorMessage(err: unknown): string | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data
      ?.message === 'string'
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return null;
}
