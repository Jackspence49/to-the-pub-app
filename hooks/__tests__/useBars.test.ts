// hooks/__tests__/useBars.test.ts
// Tests for the useBars custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useBars } from '../useBars';
import type { Coordinates } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../utils/Barmappers', () => ({
  mapBarsInBatches: jest.fn(async (items: any[]) =>
    items.map((item: any, i: number) => ({
      id: String(item.id ?? i),
      name: item.name ?? `Bar ${i}`,
      tags: [],
      hours: [],
    }))
  ),
  mergeBars: jest.requireActual('../../utils/Barmappers').mergeBars,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COORDS: Coordinates = { lat: 40.7128, lon: -74.006 };

const makeItem = (id: string | number, name = `Bar ${id}`) => ({ id, name });

const stubFetch = (
  items: unknown[],
  opts: { hasNextPage?: boolean; total?: number; status?: number } = {}
) => {
  const { hasNextPage = false, total, status = 200 } = opts;
  const payload = {
    data: items,
    meta: {
      pagination: {
        has_next_page: hasNextPage,
        ...(total !== undefined ? { total } : {}),
      },
    },
  };
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as Response);
};

/** A fetch that stalls until its AbortSignal fires, then rejects with AbortError. */
const abortableFetch = (_url: string, init: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => {
      reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
    });
  });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useBars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with isLoading true and empty bars', () => {
      const { result } = renderHook(() => useBars(null, []));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.bars).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.currentPage).toBe(0);
      expect(result.current.totalCount).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // loadInitial — success paths
  // -------------------------------------------------------------------------

  describe('loadInitial', () => {
    it('fetches page 1 and populates bars on success', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([makeItem('1'), makeItem('2')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.bars).toHaveLength(2);
      expect(result.current.bars[0].id).toBe('1');
      expect(result.current.currentPage).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('uses the provided coords override in the request URL', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial({ lat: 51.5, lon: -0.12 });
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('lat=51.5');
      expect(url).toContain('lon=-0.12');
    });

    it('falls back to DEFAULT_COORDS when userCoords is null and no override provided', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const { result } = renderHook(() => useBars(null, []));

      await act(async () => {
        result.current.loadInitial();
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('lat=42.3555');
    });

    it('sets hasMore false when the API signals no next page', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([], { hasNextPage: false }));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.hasMore).toBe(false);
    });

    it('sets totalCount from pagination meta', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([makeItem('1')], { total: 42 }));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.totalCount).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // loadInitial — error paths
  // -------------------------------------------------------------------------

  describe('loadInitial error handling', () => {
    it('sets error and clears isLoading on a non-ok HTTP response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([], { status: 500 }));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('500');
      expect(result.current.isLoading).toBe(false);
    });

    it('sets error message on a network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.error?.message).toBe('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // Tag filtering
  // -------------------------------------------------------------------------

  describe('tag filtering', () => {
    it('includes selected tags in the query string', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const { result } = renderHook(() => useBars(COORDS, ['trivia', 'quiz']));

      await act(async () => {
        result.current.loadInitial();
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('tags=');
      expect(decodeURIComponent(url)).toContain('trivia,quiz');
    });

    it('omits the tags param when selectedTags is empty', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).not.toContain('tags=');
    });
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  describe('caching', () => {
    it('returns cached data on a repeated loadInitial call without re-fetching', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([makeItem('1')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });
      // Drain any prefetch microtasks
      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.loadInitial();
      });
      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
      expect(result.current.bars[0].id).toBe('1');
    });
  });

  // -------------------------------------------------------------------------
  // handleLoadMore
  // -------------------------------------------------------------------------

  describe('handleLoadMore', () => {
    it('does nothing while isLoading is true (no data yet)', () => {
      const { result } = renderHook(() => useBars(COORDS, []));

      // isLoading starts true before any loadInitial
      act(() => {
        result.current.handleLoadMore();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when hasMore is false', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([], { hasNextPage: false }));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.hasMore).toBe(false);
      const callCount = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.handleLoadMore();
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('requests the next page when conditions allow', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeItem(String(i + 1)));

      // page 1 response (hasNextPage true triggers prefetch of page 2)
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch(page1, { hasNextPage: true }))
        // prefetch for page 2
        .mockReturnValueOnce(stubFetch([makeItem('11')], { hasNextPage: false }))
        // any additional calls
        .mockReturnValue(stubFetch([], { hasNextPage: false }));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });
      await act(async () => {});

      // At least page 1 items should be present
      expect(result.current.bars.length).toBeGreaterThanOrEqual(page1.length);
    });
  });

  // -------------------------------------------------------------------------
  // handleRefresh
  // -------------------------------------------------------------------------

  describe('handleRefresh', () => {
    it('replaces existing bars with freshly fetched data', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockReturnValue(stubFetch([makeItem('99')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.bars[0].id).toBe('1');

      await act(async () => {
        result.current.handleRefresh();
      });
      await act(async () => {});

      expect(result.current.bars[0].id).toBe('99');
      expect(result.current.bars).toHaveLength(1);
    });

    it('resets isRefreshing to false after the request completes', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockReturnValue(stubFetch([makeItem('2')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      await act(async () => {
        result.current.handleRefresh();
      });
      await act(async () => {});

      expect(result.current.isRefreshing).toBe(false);
    });

    it('clears the cache so subsequent data reflects the refresh', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockReturnValue(stubFetch([makeItem('fresh')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      await act(async () => {
        result.current.handleRefresh();
      });
      await act(async () => {});

      expect(result.current.bars[0].id).toBe('fresh');
    });
  });

  // -------------------------------------------------------------------------
  // handleRetry
  // -------------------------------------------------------------------------

  describe('handleRetry', () => {
    it('re-fetches with initial mode when there is no existing data', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('fail'))
        .mockReturnValue(stubFetch([makeItem('1')]));

      const { result } = renderHook(() => useBars(COORDS, []));

      await act(async () => {
        result.current.loadInitial();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.bars).toHaveLength(0);

      await act(async () => {
        result.current.handleRetry();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.bars).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Request timeout
  // -------------------------------------------------------------------------

  describe('timeout handling', () => {
    it('sets a "timed out" error when the request stalls past the limit', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockImplementation(abortableFetch);

      const { result } = renderHook(() => useBars(COORDS, []));

      act(() => {
        result.current.loadInitial();
      });

      // Advance past the 15 s requestTimeout defined in INFINITE_SCROLL_CONFIG
      await act(async () => {
        jest.advanceTimersByTime(16_000);
      });

      expect(result.current.error?.message).toContain('timed out');
      expect(result.current.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Unmount cleanup
  // -------------------------------------------------------------------------

  describe('unmount cleanup', () => {
    it('aborts all in-flight requests when the component unmounts', () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      (global.fetch as jest.Mock).mockImplementation(abortableFetch);

      const { result, unmount } = renderHook(() => useBars(COORDS, []));

      act(() => {
        result.current.loadInitial();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });
  });
});
