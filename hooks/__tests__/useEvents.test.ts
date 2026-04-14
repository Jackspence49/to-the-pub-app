// hooks/__tests__/useEvents.test.ts
// Tests for the useEvents custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useEvents } from '../useEvents';
import type { Coordinates } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../utils/Eventmappers', () => ({
  extractEventItems: jest.fn((payload: any) =>
    Array.isArray(payload?.data) ? payload.data : []
  ),
  mapToEvent: jest.fn((raw: any) => ({
    instance_id: String(raw.id),
    title: raw.title ?? 'Event',
    bar_name: raw.bar_name ?? 'Unknown bar',
    crosses_midnight: false,
  })),
  mergeEvents: jest.requireActual('../../utils/Eventmappers').mergeEvents,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COORDS: Coordinates = { lat: 40.7128, lon: -74.006 };
const NO_TAGS: string[] = [];   // stable reference — prevents useCallback churn
const RADIUS = 5;

const makeItem = (id: string | number, title = `Event ${id}`) => ({ id, title });

const stubFetch = (
  items: unknown[],
  opts: { hasNextPage?: boolean; currentPage?: number; status?: number } = {}
) => {
  const { hasNextPage = false, currentPage = 1, status = 200 } = opts;
  const payload = {
    data: items,
    meta: {
      pagination: {
        has_next_page: hasNextPage,
        current_page: currentPage,
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

describe('useEvents', () => {
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
    it('starts with isInitialLoading true and empty events', () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      expect(result.current.isInitialLoading).toBe(true);
      expect(result.current.events).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.isPaginating).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-fetch on mount
  // -------------------------------------------------------------------------

  describe('auto-fetch on mount', () => {
    it('populates events and clears isInitialLoading on success', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubFetch([makeItem('1'), makeItem('2')])
      );

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.isInitialLoading).toBe(false);
      expect(result.current.events).toHaveLength(2);
      expect(result.current.events[0].instance_id).toBe('1');
      expect(result.current.error).toBeNull();
    });

    it('falls back to DEFAULT_COORDS (Boston) when userCoords is null', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(null, NO_TAGS, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('lat=42.3555');
      expect(url).toContain('lon=-71.0565');
    });

    it('uses provided userCoords in the request URL', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('lat=40.7128');
      expect(url).toContain('lon=-74.006');
    });

    it('includes searchRadius in the request URL', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, NO_TAGS, 10));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('radius=10');
    });

    it('requests the /events/instances endpoint', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/events/instances');
    });

    it('sets hasMore false when API signals no next page', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubFetch([], { hasNextPage: false })
      );

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.hasMore).toBe(false);
    });

    it('sets hasMore true when API signals next page exists', async () => {
      const items = Array.from({ length: 10 }, (_, i) => makeItem(i + 1));
      (global.fetch as jest.Mock).mockReturnValue(
        stubFetch(items, { hasNextPage: true })
      );

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.hasMore).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Tag filtering
  // -------------------------------------------------------------------------

  describe('tag filtering', () => {
    it('includes event_tag_id in the query when a tag is selected', async () => {
      const tags = ['trivia'];
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, tags, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('event_tag_id=trivia');
    });

    it('omits event_tag_id when selectedTagIds is empty', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).not.toContain('event_tag_id');
    });

    it('uses only the first tag when multiple are selected', async () => {
      const tags = ['trivia', 'quiz'];
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      renderHook(() => useEvents(COORDS, tags, RADIUS));

      await act(async () => {});

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('event_tag_id=trivia');
      expect(url).not.toContain('quiz');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('sets error and clears isInitialLoading on a non-ok HTTP response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([], { status: 500 }));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.error).toContain('500');
      expect(result.current.isInitialLoading).toBe(false);
    });

    it('sets error message on a network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.error).toBe('Network error');
    });

    it('swallows AbortError silently without setting error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('AbortError'), { name: 'AbortError' })
      );

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  describe('caching', () => {
    it('serves cached data on refresh within the TTL without re-fetching', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([makeItem('1')]));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      // Refresh within cache TTL — should hit cache, not network
      await act(async () => {
        result.current.handleRefresh();
      });

      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
      expect(result.current.events[0].instance_id).toBe('1');
    });

    it('bypasses cache on paginate mode (handleEndReached)', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeItem(i + 1));
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch(page1, { hasNextPage: true, currentPage: 1 }))
        .mockReturnValue(stubFetch([makeItem('11')], { hasNextPage: false, currentPage: 2 }));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.handleEndReached();
      });

      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  // -------------------------------------------------------------------------
  // handleRefresh
  // -------------------------------------------------------------------------

  describe('handleRefresh', () => {
    it('replaces existing events with freshly fetched data once cache expires', async () => {
      jest.useFakeTimers();
      const start = Date.now();
      jest.setSystemTime(start);

      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockReturnValue(stubFetch([makeItem('99')]));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.events[0].instance_id).toBe('1');

      // Expire the 5-minute cache so refresh performs a real fetch
      jest.setSystemTime(start + 300_001);

      await act(async () => {
        result.current.handleRefresh();
      });

      await act(async () => {});

      expect(result.current.events[0].instance_id).toBe('99');
      expect(result.current.events).toHaveLength(1);
    });

    it('resets isRefreshing to false after the request completes', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockReturnValue(stubFetch([makeItem('2')]));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      await act(async () => {
        result.current.handleRefresh();
      });

      await act(async () => {});

      expect(result.current.isRefreshing).toBe(false);
    });

    it('does nothing when isInitialLoading is true', () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      expect(result.current.isInitialLoading).toBe(true);
      const callsBefore = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.handleRefresh();
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // handleEndReached
  // -------------------------------------------------------------------------

  describe('handleEndReached', () => {
    it('does nothing when hasMore is false', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubFetch([], { hasNextPage: false })
      );

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.hasMore).toBe(false);
      const callCount = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.handleEndReached();
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('does nothing when isInitialLoading is true', () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      expect(result.current.isInitialLoading).toBe(true);
      const callsBefore = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.handleEndReached();
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    });

    it('merges next page into existing events', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeItem(i + 1));
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch(page1, { hasNextPage: true, currentPage: 1 }))
        .mockReturnValue(stubFetch([makeItem('11')], { hasNextPage: false, currentPage: 2 }));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.events).toHaveLength(10);

      await act(async () => {
        result.current.handleEndReached();
      });

      await act(async () => {});

      expect(result.current.events).toHaveLength(11);
      expect(result.current.events[10].instance_id).toBe('11');
    });

    it('sets isPaginating to false after the request completes', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeItem(i + 1));
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch(page1, { hasNextPage: true, currentPage: 1 }))
        .mockReturnValue(stubFetch([makeItem('11')], { hasNextPage: false, currentPage: 2 }));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      await act(async () => {
        result.current.handleEndReached();
      });

      await act(async () => {});

      expect(result.current.isPaginating).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // handleRetry
  // -------------------------------------------------------------------------

  describe('handleRetry', () => {
    it('uses initial mode (clears events) when there is no existing data', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('fail'))
        .mockReturnValue(stubFetch([makeItem('1')]));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      await act(async () => {});

      expect(result.current.error).not.toBeNull();
      expect(result.current.events).toHaveLength(0);

      await act(async () => {
        result.current.handleRetry();
      });

      await act(async () => {});

      expect(result.current.error).toBeNull();
      expect(result.current.events).toHaveLength(1);
    });

    it('uses refresh mode (keeps events visible) when events are already loaded', async () => {
      jest.useFakeTimers();
      const start = Date.now();
      jest.setSystemTime(start);

      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubFetch([makeItem('1')]))
        .mockRejectedValueOnce(new Error('fail'))
        .mockReturnValue(stubFetch([makeItem('2')]));

      const { result } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      // Load initial data
      await act(async () => {});

      expect(result.current.events).toHaveLength(1);

      // Expire cache so subsequent fetches actually hit the network
      jest.setSystemTime(start + 300_001);

      // Trigger a refresh that fails
      await act(async () => {
        result.current.handleRefresh();
      });

      await act(async () => {});

      // Events still present from initial load; retry should fetch again
      await act(async () => {
        result.current.handleRetry();
      });

      await act(async () => {});

      expect(result.current.error).toBeNull();
      expect(result.current.events[0].instance_id).toBe('2');
    });
  });

  // -------------------------------------------------------------------------
  // Re-fetch on param change
  // -------------------------------------------------------------------------

  describe('re-fetch on param change', () => {
    it('re-fetches when userCoords changes', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const newCoords = { lat: 51.5, lon: -0.12 };
      const { rerender } = renderHook(
        ({ coords }: { coords: Coordinates | null }) =>
          useEvents(coords, NO_TAGS, RADIUS),
        { initialProps: { coords: COORDS } }
      );

      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      rerender({ coords: newCoords });

      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
      const lastUrl = (global.fetch as jest.Mock).mock.calls.at(-1)[0] as string;
      expect(lastUrl).toContain('lat=51.5');
    });

    it('re-fetches when selectedTagIds changes', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const tagsWithTrivia = ['trivia'];
      const { rerender } = renderHook(
        ({ tags }: { tags: string[] }) => useEvents(COORDS, tags, RADIUS),
        { initialProps: { tags: NO_TAGS } }
      );

      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      rerender({ tags: tagsWithTrivia });

      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
      const lastUrl = (global.fetch as jest.Mock).mock.calls.at(-1)[0] as string;
      expect(lastUrl).toContain('event_tag_id=trivia');
    });

    it('re-fetches when searchRadius changes', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubFetch([]));

      const { rerender } = renderHook(
        ({ radius }: { radius: number }) => useEvents(COORDS, NO_TAGS, radius),
        { initialProps: { radius: 5 } }
      );

      await act(async () => {});

      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      rerender({ radius: 15 });

      await act(async () => {});

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
      const lastUrl = (global.fetch as jest.Mock).mock.calls.at(-1)[0] as string;
      expect(lastUrl).toContain('radius=15');
    });
  });

  // -------------------------------------------------------------------------
  // Unmount cleanup
  // -------------------------------------------------------------------------

  describe('unmount cleanup', () => {
    it('aborts all in-flight requests when the component unmounts', () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      (global.fetch as jest.Mock).mockImplementation(abortableFetch);

      const { unmount } = renderHook(() => useEvents(COORDS, NO_TAGS, RADIUS));

      unmount();

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });
  });
});
