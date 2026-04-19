import * as SecureStore from 'expo-secure-store';
import React, { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type LoginPayload = {
  email: string;
  password: string;
};

type AuthenticatedUser = {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  dob?: string;
  last_login?: string;
  created_at?: string;
  [key: string]: unknown;
};

type AuthActionResult = {
  success: boolean;
  message?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthActionResult>;
  loginWithToken: (token: string, user?: AuthenticatedUser | null) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<AuthActionResult>;
};

const TOKEN_STORAGE_KEY = 'ttp-auth-token';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const pingLastAccessed = (activeToken: string) => {
      if (!normalizedBaseUrl) return;
      fetch(`${normalizedBaseUrl}/appUsers/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      }).catch(() => {});
    };

    const fetchMe = async (activeToken: string): Promise<AuthenticatedUser | null> => {
      if (!normalizedBaseUrl) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${normalizedBaseUrl}/appUsers/me`, {
          headers: { Authorization: `Bearer ${activeToken}` },
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error('server_error');
        }
        const json = await response.json();
        return (json?.data as AuthenticatedUser) ?? null;
      } finally {
        clearTimeout(timeout);
      }
    };

    const bootstrapAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        if (!isMounted) return;

        if (!storedToken) {
          setStatus('unauthenticated');
          return;
        }

        let meUser: AuthenticatedUser | null = null;
        let tokenInvalid = false;

        try {
          meUser = await fetchMe(storedToken);
          if (meUser === null && normalizedBaseUrl) {
            // null from fetchMe means a 401/403/404 — token is bad
            tokenInvalid = true;
          }
        } catch {
          // Network error or timeout — trust the stored token but user stays null
        }

        if (!isMounted) return;

        if (tokenInvalid) {
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
          setStatus('unauthenticated');
          return;
        }

        setToken(storedToken);
        setUser(meUser);
        setStatus('authenticated');
        pingLastAccessed(storedToken);
      } catch {
        if (isMounted) {
          setStatus('unauthenticated');
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }: LoginPayload): Promise<AuthActionResult> => {
    if (!normalizedBaseUrl) {
      return {
        success: false,
        message: 'Set EXPO_PUBLIC_API_URL to enable sign in.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      let response;
      try {
        response = await fetch(`${normalizedBaseUrl}/appUsers/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      type LoginResponse = { token?: string; message?: string; user?: AuthenticatedUser } | null;
      let payload: LoginResponse = null;
      try {
        payload = await response.json() as LoginResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.token) {
        return {
          success: false,
          message: payload?.message ?? 'Check your email and password.',
        };
      }

      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setUser(payload?.user ?? null);
      setStatus('authenticated');

      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        message: (error instanceof Error && error.name === 'AbortError')
          ? 'The request timed out. Please check your connection and try again.'
          : 'Unable to sign in right now. Please try again.',
      };
    }
  }, []);

  const loginWithToken = useCallback(async (newToken: string, newUser?: AuthenticatedUser | null) => {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser ?? null);
    setStatus('authenticated');
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthActionResult> => {
    if (!normalizedBaseUrl) {
      return { success: false, message: 'Set EXPO_PUBLIC_API_URL to enable this action.' };
    }
    if (!token) {
      return { success: false, message: 'Not authenticated.' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(`${normalizedBaseUrl}/appUsers/me`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        let message: string | undefined;
        try {
          const json = await response.json() as { message?: string };
          message = json?.message;
        } catch { /* ignore */ }
        return { success: false, message: message ?? 'Failed to delete account. Please try again.' };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: (error instanceof Error && error.name === 'AbortError')
          ? 'The request timed out. Please check your connection and try again.'
          : 'Unable to delete account right now. Please try again.',
      };
    }

    setStatus('checking');
    setUser(null);
    setToken(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } finally {
      setStatus('unauthenticated');
    }
    return { success: true };
  }, [token]);

  const logout = useCallback(async () => {
    setStatus('checking');
    setUser(null);
    setToken(null);

    try {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } finally {
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      user,
      isAuthenticated: status === 'authenticated',
      login,
      loginWithToken,
      logout,
      deleteAccount,
    }),
    [status, token, user, login, loginWithToken, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
