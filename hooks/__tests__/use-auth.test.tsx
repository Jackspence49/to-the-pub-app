// hooks/__tests__/use-auth.test.tsx
// Tests for the AuthProvider and useAuth hook

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../use-auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  ...overrides,
});

const stubFetch = (
  body: unknown,
  opts: { status?: number; ok?: boolean } = {}
) => {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('use-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // useAuth outside provider
  // -------------------------------------------------------------------------

  describe('useAuth outside AuthProvider', () => {
    it('throws when called outside AuthProvider', () => {
      // Suppress the expected error from React
      jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Bootstrap — no stored token
  // -------------------------------------------------------------------------

  describe('bootstrap: no stored token', () => {
    it('starts as checking then resolves to unauthenticated', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.status).toBe('checking');

      await act(async () => {});

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Bootstrap — valid stored token
  // -------------------------------------------------------------------------

  describe('bootstrap: valid stored token', () => {
    it('sets authenticated with user when /me returns a user', async () => {
      const user = makeUser();
      mockGetItemAsync.mockResolvedValue('stored-token');
      (global.fetch as jest.Mock).mockReturnValue(
        stubFetch({ data: user })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      expect(result.current.status).toBe('authenticated');
      expect(result.current.token).toBe('stored-token');
      expect(result.current.user).toEqual(user);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('sends the token in the Authorization header for /me', async () => {
      mockGetItemAsync.mockResolvedValue('my-token');
      (global.fetch as jest.Mock).mockReturnValue(stubFetch({ data: makeUser() }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/appUsers/me');
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer my-token',
      });
    });

    it('calls the ping endpoint after successful bootstrap', async () => {
      mockGetItemAsync.mockResolvedValue('my-token');
      (global.fetch as jest.Mock).mockReturnValue(stubFetch({ data: makeUser() }));

      renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
      expect(urls.some((u) => u.includes('/appUsers/ping'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Bootstrap — invalid stored token
  // -------------------------------------------------------------------------

  describe('bootstrap: invalid stored token', () => {
    it.each([401, 403, 404])(
      'deletes token and becomes unauthenticated on %i from /me',
      async (status) => {
        mockGetItemAsync.mockResolvedValue('bad-token');
        (global.fetch as jest.Mock).mockReturnValue(stubFetch({}, { status, ok: false }));

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {});

        expect(result.current.status).toBe('unauthenticated');
        expect(mockDeleteItemAsync).toHaveBeenCalledWith('ttp-auth-token');
      }
    );

    it('stays authenticated on network error from /me (trusts stored token)', async () => {
      mockGetItemAsync.mockResolvedValue('my-token');
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      expect(result.current.status).toBe('authenticated');
      expect(result.current.token).toBe('my-token');
      expect(result.current.user).toBeNull();
    });
  });


  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe('login', () => {

    it('sets authenticated state and stores token on successful login', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      const user = makeUser();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          stubFetch({ token: 'new-token', user })
        );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      let actionResult: { success: boolean } | undefined;
      await act(async () => {
        actionResult = await result.current.login({ email: 'a@b.com', password: 'pw' });
      });

      expect(actionResult?.success).toBe(true);
      expect(result.current.status).toBe('authenticated');
      expect(result.current.token).toBe('new-token');
      expect(result.current.user).toEqual(user);
      expect(mockSetItemAsync).toHaveBeenCalledWith('ttp-auth-token', 'new-token');
    });

    it('trims leading/trailing whitespace from the email before sending', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        stubFetch({ token: 't', user: makeUser() })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      await act(async () => {
        await result.current.login({ email: '  a@b.com  ', password: 'pw' });
      });

      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string
      );
      expect(body.email).toBe('a@b.com');
    });

    it('returns failure with API message on non-ok response', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        stubFetch({ message: 'Invalid credentials' }, { status: 401, ok: false })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      let actionResult: { success: boolean; message?: string } | undefined;
      await act(async () => {
        actionResult = await result.current.login({ email: 'a@b.com', password: 'wrong' });
      });

      expect(actionResult?.success).toBe(false);
      expect(actionResult?.message).toBe('Invalid credentials');
    });

    it('uses fallback message when API returns no message', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        stubFetch({}, { status: 401, ok: false })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      let actionResult: { success: boolean; message?: string } | undefined;
      await act(async () => {
        actionResult = await result.current.login({ email: 'a@b.com', password: 'pw' });
      });

      expect(actionResult?.success).toBe(false);
      expect(actionResult?.message).toBe('Check your email and password.');
    });

    it('returns timeout message on AbortError', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('AbortError'), { name: 'AbortError' })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      let actionResult: { success: boolean; message?: string } | undefined;
      await act(async () => {
        actionResult = await result.current.login({ email: 'a@b.com', password: 'pw' });
      });

      expect(actionResult?.success).toBe(false);
      expect(actionResult?.message).toContain('timed out');
    });

    it('returns generic error message on unexpected error', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Unexpected'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      let actionResult: { success: boolean; message?: string } | undefined;
      await act(async () => {
        actionResult = await result.current.login({ email: 'a@b.com', password: 'pw' });
      });

      expect(actionResult?.success).toBe(false);
      expect(actionResult?.message).toContain('Unable to sign in');
    });
  });

  // -------------------------------------------------------------------------
  // loginWithToken
  // -------------------------------------------------------------------------

  describe('loginWithToken', () => {
    it('sets authenticated state and stores the token', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      const user = makeUser();
      await act(async () => {
        await result.current.loginWithToken('direct-token', user);
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.token).toBe('direct-token');
      expect(result.current.user).toEqual(user);
      expect(mockSetItemAsync).toHaveBeenCalledWith('ttp-auth-token', 'direct-token');
    });

    it('sets user to null when no user is passed', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      await act(async () => {
        await result.current.loginWithToken('token-only');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.status).toBe('authenticated');
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('clears state and deletes the stored token', async () => {
      const user = makeUser();
      mockGetItemAsync.mockResolvedValue('active-token');
      (global.fetch as jest.Mock).mockReturnValue(stubFetch({ data: user }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});

      expect(result.current.status).toBe('authenticated');

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('ttp-auth-token');
    });
  });
});
