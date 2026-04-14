// hooks/__tests__/useSearch.test.ts
// Tests for the useSearch custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useSearch } from '../useSearch';
import { SEARCH_DEBOUNCE_MS } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeItem = (id: string | number, name = `Bar ${id}`) => ({
  id,
  name,
  address_city: 'Boston',
  address_state: 'MA',
});

const stubFetch = (items: unknown[], status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ data: items }),
  } as Response);

const stubFetchFlat = (items: unknown[]) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(items),
  } as Response);

const stubFetchError = (status = 500) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response);

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

describe('useSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockResolvedValue(stubFetch([]) as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns all expected fields', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe('');
      expect(typeof result.current.setQuery).toBe('function');
      expect(Array.isArray(result.current.results)).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.canSearch).toBe(false);
      expect(result.current.effectiveQuery).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // canSearch
  // -------------------------------------------------------------------------

  describe('canSearch', () => {
    it('is false when query is empty', () => {
      const { result } = renderHook(() => useSearch());
      expect(result.current.canSearch).toBe(false);
    });

    it('is false when query is 1 character', () => {
      const { result } = renderHook(() => useSearch());
      act(() => { result.current.setQuery('a'); });
      expect(result.current.canSearch).toBe(false);
    });

    it('is true when query is 2 or more characters', () => {
      const { result } = renderHook(() => useSearch());
      act(() => { result.current.setQuery('ab'); });
      expect(result.current.canSearch).toBe(true);
    });

    it('is false when query is only whitespace', () => {
      const { result } = renderHook(() => useSearch());
      act(() => { result.current.setQuery('   '); });
      expect(result.current.canSearch).toBe(false);
    });

    it('trims whitespace for canSearch evaluation', () => {
      const { result } = renderHook(() => useSearch());
      act(() => { result.current.setQuery('  a  '); });
      // trimmed is 'a' — length 1 — so canSearch is false
      expect(result.current.canSearch).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // effectiveQuery
  // -------------------------------------------------------------------------

  describe('effectiveQuery', () => {
    it('is the trimmed version of query', () => {
      const { result } = renderHook(() => useSearch());
      act(() => { result.current.setQuery('  Boston  '); });
      expect(result.current.effectiveQuery).toBe('Boston');
    });
  });

  // -------------------------------------------------------------------------
  // Short / empty query — no fetch
  // -------------------------------------------------------------------------

  describe('short query', () => {
    it('does not fetch when query is shorter than 2 chars', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('a'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('clears results when query becomes too short', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([makeItem(1)]) as any
      );
      const { result } = renderHook(() => useSearch());

      // Search for something
      act(() => { result.current.setQuery('pub'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      // Shorten query below threshold
      act(() => { result.current.setQuery('p'); });
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.results).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Debounce
  // -------------------------------------------------------------------------

  describe('debounce', () => {
    it('does not fetch before the debounce delay elapses', () => {
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      act(() => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1); });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches after the debounce delay elapses', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('only fires one request for rapid successive keystrokes', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('p');
        result.current.setQuery('pu');
        result.current.setQuery('pub');
      });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Successful search
  // -------------------------------------------------------------------------

  describe('successful search', () => {
    it('populates results from payload.data array', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([makeItem(1, 'The Tap'), makeItem(2, 'Corner Bar')]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('tap'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results).toHaveLength(2);
      expect(result.current.results[0]).toMatchObject({ id: '1', name: 'The Tap' });
      expect(result.current.results[1]).toMatchObject({ id: '2', name: 'Corner Bar' });
    });

    it('populates results from a flat array payload', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetchFlat([makeItem(3, 'Flat Bar')]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('flat'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].name).toBe('Flat Bar');
    });

    it('casts id to string', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([{ id: 42, name: 'Number Id Bar' }]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('num'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(typeof result.current.results[0].id).toBe('string');
      expect(result.current.results[0].id).toBe('42');
    });

    it('falls back to "Unnamed bar" when name is missing', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([{ id: 5 }]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('bar'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results[0].name).toBe('Unnamed bar');
    });

    it('accepts address_state / address_city as alternative field names', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([{ id: 6, name: 'Alt Fields', city: 'Salem', state: 'MA' }]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('alt'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results[0].address_city).toBe('Salem');
      expect(result.current.results[0].address_state).toBe('MA');
    });

    it('filters out items with null or empty id', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([
          { id: null, name: 'No ID' },
          { id: '', name: 'Empty ID' },
          { id: 7, name: 'Valid' },
        ]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('bar'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].name).toBe('Valid');
    });

    it('sets results to [] when payload contains no valid items', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        stubFetch([]) as any
      );
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('xyz'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.results).toEqual([]);
    });

    it('sets isLoading to false after a successful fetch', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.isLoading).toBe(false);
    });

    it('sends the trimmed query in the URL', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('  tap  '); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=tap'),
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    // The hook retries once with a 1000 ms delay, so we must advance timers in
    // two separate acts: first fire the debounce, then fire the retry delay.

    it('sets error when the response is not ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(stubFetchError(500) as any);
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      // Fire debounce — first fetch runs and fails
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
      // Fire retry delay — retry fetch runs and fails, error is set
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(result.current.error).toBe('Unable to search right now.');
    });

    it('retries once on error before setting error state', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(stubFetchError(500) as any);
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBe('Unable to search right now.');
    });

    it('sets isLoading to false after an error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(stubFetchError() as any);
      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
      await act(async () => { jest.advanceTimersByTime(1000); });

      expect(result.current.isLoading).toBe(false);
    });

    it('clears error when a new successful search runs', async () => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(stubFetchError() as any)
        .mockResolvedValueOnce(stubFetchError() as any) // retry also fails
        .mockResolvedValue(stubFetch([makeItem(1)]) as any);

      const { result } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('err'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(result.current.error).not.toBeNull();

      act(() => { result.current.setQuery('ok!'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Abort / cleanup
  // -------------------------------------------------------------------------

  describe('abort and cleanup', () => {
    it('ignores a stale response when query changes before fetch resolves', async () => {
      jest.spyOn(global, 'fetch')
        .mockImplementationOnce(abortableFetch)
        .mockResolvedValue(stubFetch([makeItem(2, 'New Result')]) as any);

      const { result } = renderHook(() => useSearch());

      // Start first search
      act(() => { result.current.setQuery('old'); });
      act(() => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });

      // Change query before first fetch resolves — aborts the first request
      act(() => { result.current.setQuery('new'); });
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      // Only the second (non-aborted) result should be present
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].name).toBe('New Result');
    });

    it('does not update state after unmount', async () => {
      const { result, unmount } = renderHook(() => useSearch());

      act(() => { result.current.setQuery('pub'); });
      unmount();
      // Let the debounce fire after unmount — should not throw
      await act(async () => { jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100); });

      // No assertion beyond "no error thrown"
    });
  });
});
