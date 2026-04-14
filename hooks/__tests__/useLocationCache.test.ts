// hooks/__tests__/useLocationCache.test.ts
// Tests for the useLocationCache custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useLocationCache } from '../UseLocationCache';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock with a factory so the real native module never loads
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location = require('expo-location') as {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

const mockGetForegroundPermissionsAsync = Location.getForegroundPermissionsAsync;
const mockRequestForegroundPermissionsAsync = Location.requestForegroundPermissionsAsync;
const mockGetCurrentPositionAsync = Location.getCurrentPositionAsync;

const grantedPermission = (canAskAgain = true) => ({
  status: 'granted',
  canAskAgain,
  granted: true,
  expires: 'never',
});

const deniedPermission = (canAskAgain = true) => ({
  status: 'denied',
  canAskAgain,
  granted: false,
  expires: 'never',
});

const makePosition = (lat: number, lon: number) => ({
  coords: { latitude: lat, longitude: lon },
  timestamp: Date.now(),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useLocationCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fake timers prevent the hook's internal 10-second location-timeout
    // setTimeout from keeping the process alive after each test.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with userCoords null and locationDeniedPermanently false', () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useLocationCache());

      expect(result.current.userCoords).toBeNull();
      expect(result.current.locationDeniedPermanently).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // ensureLocationPermission
  // -------------------------------------------------------------------------

  describe('ensureLocationPermission', () => {
    it('returns true immediately when permission is already granted', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());

      const { result } = renderHook(() => useLocationCache());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.ensureLocationPermission();
      });

      expect(granted).toBe(true);
      expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests permission when status is not yet granted', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(true));
      mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedPermission());

      const { result } = renderHook(() => useLocationCache());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.ensureLocationPermission();
      });

      expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(granted).toBe(true);
    });

    it('returns false and sets locationDeniedPermanently when canAskAgain is false on check', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(false));

      const { result } = renderHook(() => useLocationCache());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.ensureLocationPermission();
      });

      expect(granted).toBe(false);
      expect(result.current.locationDeniedPermanently).toBe(true);
      expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('sets locationDeniedPermanently when permission request is denied with canAskAgain false', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(true));
      mockRequestForegroundPermissionsAsync.mockResolvedValue(deniedPermission(false));

      const { result } = renderHook(() => useLocationCache());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.ensureLocationPermission();
      });

      expect(granted).toBe(false);
      expect(result.current.locationDeniedPermanently).toBe(true);
    });

    it('returns false without setting locationDeniedPermanently when denied but canAskAgain is true', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(true));
      mockRequestForegroundPermissionsAsync.mockResolvedValue(deniedPermission(true));

      const { result } = renderHook(() => useLocationCache());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.ensureLocationPermission();
      });

      expect(granted).toBe(false);
      expect(result.current.locationDeniedPermanently).toBe(false);
    });

    it('skips the OS check on subsequent calls once permission is confirmed granted', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());

      const { result } = renderHook(() => useLocationCache());

      await act(async () => {
        await result.current.ensureLocationPermission();
      });

      mockGetForegroundPermissionsAsync.mockClear();

      await act(async () => {
        await result.current.ensureLocationPermission();
      });

      // Should short-circuit using the cached ref — no second OS call
      expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refreshUserLocation
  // -------------------------------------------------------------------------

  describe('refreshUserLocation', () => {
    it('updates userCoords on a successful fetch', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockResolvedValue(makePosition(51.5, -0.12));

      const { result } = renderHook(() => useLocationCache());

      await act(async () => {
        await result.current.refreshUserLocation();
      });

      expect(result.current.userCoords).toEqual({ lat: 51.5, lon: -0.12 });
    });

    it('returns null when permission is denied', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(false));

      const { result } = renderHook(() => useLocationCache());

      let coords: unknown;
      await act(async () => {
        coords = await result.current.refreshUserLocation();
      });

      expect(coords).toBeNull();
      expect(result.current.userCoords).toBeNull();
    });

    it('returns null and warns when getCurrentPositionAsync throws', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockRejectedValue(new Error('GPS unavailable'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocationCache());

      let coords: unknown;
      await act(async () => {
        coords = await result.current.refreshUserLocation();
      });

      expect(coords).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('deduplicates concurrent calls — only one inflight request at a time', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());

      let resolvePosition!: (value: unknown) => void;
      mockGetCurrentPositionAsync.mockReturnValue(
        new Promise((res) => { resolvePosition = res; })
      );

      const { result } = renderHook(() => useLocationCache());

      let p1: Promise<unknown>, p2: Promise<unknown>;
      act(() => {
        p1 = result.current.refreshUserLocation();
        p2 = result.current.refreshUserLocation();
      });

      await act(async () => {
        resolvePosition(makePosition(10, 20));
        await Promise.all([p1!, p2!]);
      });

      expect(mockGetCurrentPositionAsync).toHaveBeenCalledTimes(1);
    });

    it('returns null and warns when the request times out', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockReturnValue(new Promise(() => {})); // never resolves

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocationCache());

      // Start the fetch and let microtasks drain so ensureLocationPermission
      // resolves and the hook registers its timeout setTimeout.
      const fetchP = result.current.refreshUserLocation();
      await act(async () => {});

      // Now fire the registered timeout timer.
      act(() => { jest.advanceTimersByTime(10_001); });

      const coords = await fetchP;

      expect(coords).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // getCachedLocation
  // -------------------------------------------------------------------------

  describe('getCachedLocation', () => {
    it('returns null before any location is fetched', () => {
      const { result } = renderHook(() => useLocationCache());

      expect(result.current.getCachedLocation()).toBeNull();
    });

    it('returns coords immediately after a successful fetch', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockResolvedValue(makePosition(48.8, 2.35));

      const { result } = renderHook(() => useLocationCache());

      await act(async () => {
        await result.current.refreshUserLocation();
      });

      expect(result.current.getCachedLocation()).toEqual({ lat: 48.8, lon: 2.35 });
    });

    it('returns null after the 5-minute TTL has expired', async () => {
      const start = Date.now();
      jest.setSystemTime(start);

      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockResolvedValue(makePosition(48.8, 2.35));

      const { result } = renderHook(() => useLocationCache());

      await act(async () => {
        await result.current.refreshUserLocation();
      });

      expect(result.current.getCachedLocation()).not.toBeNull();

      jest.setSystemTime(start + 5 * 60 * 1000 + 1);

      expect(result.current.getCachedLocation()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentCoordinates
  // -------------------------------------------------------------------------

  describe('getCurrentCoordinates', () => {
    it('returns fresh coords from the cache when within TTL', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockResolvedValue(makePosition(51.5, -0.12));

      const { result } = renderHook(() => useLocationCache());

      await act(async () => {
        await result.current.refreshUserLocation();
      });

      mockGetCurrentPositionAsync.mockClear();

      let coords: unknown;
      await act(async () => {
        coords = await result.current.getCurrentCoordinates();
      });

      expect(coords).toEqual({ lat: 51.5, lon: -0.12 });
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('fetches fresh coords when cache is empty', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync.mockResolvedValue(makePosition(40.71, -74.0));

      const { result } = renderHook(() => useLocationCache());

      let coords: unknown;
      await act(async () => {
        coords = await result.current.getCurrentCoordinates();
      });

      expect(coords).toEqual({ lat: 40.71, lon: -74.0 });
    });

    it('falls back to DEFAULT_COORDS (Boston) when fetch fails and no prior coords exist', async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission(false));
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocationCache());

      let coords: unknown;
      await act(async () => {
        coords = await result.current.getCurrentCoordinates();
      });

      expect(coords).toEqual({ lat: 42.3555, lon: -71.0565 });
    });

    it('falls back to last known userCoords when cache has expired and fresh fetch fails', async () => {
      const start = Date.now();
      jest.setSystemTime(start);

      mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission());
      mockGetCurrentPositionAsync
        .mockResolvedValueOnce(makePosition(34.05, -118.24))
        .mockRejectedValue(new Error('GPS error'));

      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocationCache());

      // First fetch — populate userCoordsRef
      await act(async () => {
        await result.current.refreshUserLocation();
      });

      // Expire the cache
      jest.setSystemTime(start + 5 * 60 * 1000 + 1);

      let coords: unknown;
      await act(async () => {
        coords = await result.current.getCurrentCoordinates();
      });

      // Should have fallen back to the last known coords, not Boston
      expect(coords).toEqual({ lat: 34.05, lon: -118.24 });
    });
  });
});
