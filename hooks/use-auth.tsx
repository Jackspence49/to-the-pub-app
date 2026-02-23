import * as SecureStore from 'expo-secure-store';
import React, { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type LoginPayload = {
  email: string;
  password: string;
};

type AuthenticatedUser = {
  id: string;
  name?: string;
  email?: string;
  [Token: string]: unknown;
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
  logout: () => Promise<void>;
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

    const bootstrapAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        if (!isMounted) {
          return;
        }

        if (storedToken) {
          setToken(storedToken);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
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
      const response = await fetch(`${normalizedBaseUrl}/app-users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
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
    } catch {
      return {
        success: false,
        message: 'Unable to sign in right now. Please try again.',
      };
    }
  }, []);

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
      logout,
    }),
    [status, token, user, login, logout],
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
