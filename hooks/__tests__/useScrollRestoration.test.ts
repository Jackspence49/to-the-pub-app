// hooks/__tests__/useScrollRestoration.test.ts
// Tests for the useScrollRestoration custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useScrollRestoration } from '../useScrollRestoration';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    // Use React's useEffect so:
    //  - the callback runs once on mount (simulating initial focus)
    //  - the returned cleanup runs on unmount (so clearTimeout fires correctly)
    //  - it does NOT re-run on every rerender
    // jest.mock factories are hoisted before imports, so require() is needed here
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => cb(), []);
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeScrollEvent = (y: number) =>
  ({ nativeEvent: { contentOffset: { y } } } as any);

const makeMockList = () => ({ scrollToOffset: jest.fn() } as any);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useScrollRestoration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns listRef and handleScroll', () => {
      const { result } = renderHook(() => useScrollRestoration(0));

      expect(result.current.listRef).toBeDefined();
      expect(typeof result.current.handleScroll).toBe('function');
    });

    it('listRef.current starts as null', () => {
      const { result } = renderHook(() => useScrollRestoration(0));

      expect(result.current.listRef.current).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // handleScroll — records offset
  // -------------------------------------------------------------------------

  describe('handleScroll', () => {
    it('records the Y offset so it can be restored later', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(200));
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).toHaveBeenCalledWith({ offset: 200, animated: false });
    });

    it('always keeps the latest offset', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(100));
        result.current.handleScroll(makeScrollEvent(500));
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).toHaveBeenCalledWith({ offset: 500, animated: false });
    });
  });

  // -------------------------------------------------------------------------
  // useFocusEffect — restores scroll after 50 ms delay
  // -------------------------------------------------------------------------

  describe('scroll restoration on focus', () => {
    it('does not scroll when offset is 0', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    });

    it('does not scroll before the 50 ms delay elapses', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(300));
      });

      act(() => {
        jest.advanceTimersByTime(30);
      });

      expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    });

    it('scrolls to the saved offset after the 50 ms delay', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(300));
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: false });
    });

    it('always uses animated: false', () => {
      const { result } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(100));
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({ animated: false })
      );
    });

    it('does not scroll when listRef is not yet attached', () => {
      const { result } = renderHook(() => useScrollRestoration(0));

      act(() => {
        result.current.handleScroll(makeScrollEvent(300));
      });

      // listRef.current left as null — no crash and no scroll attempt
      act(() => {
        jest.advanceTimersByTime(50);
      });

      // No assertion needed beyond "no throw", but verify ref is still null
      expect(result.current.listRef.current).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // useEffect — restores scroll when data loads while restore is pending
  // -------------------------------------------------------------------------

  describe('scroll restoration when itemCount changes', () => {
    it('scrolls when itemCount becomes > 0 while a restore is pending', () => {
      const { result, rerender } = renderHook(
        ({ count }: { count: number }) => useScrollRestoration(count),
        { initialProps: { count: 0 } }
      );

      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(150));
      });

      // Rerender with items before the 50 ms timer fires — restore should trigger here
      rerender({ count: 10 });

      expect(mockList.scrollToOffset).toHaveBeenCalledWith({ offset: 150, animated: false });
    });

    it('does not scroll again when itemCount changes but restore is no longer pending', () => {
      const { result, rerender } = renderHook(
        ({ count }: { count: number }) => useScrollRestoration(count),
        { initialProps: { count: 0 } }
      );

      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(150));
      });

      // Let the focus timer fire — this clears the pending flag
      act(() => {
        jest.advanceTimersByTime(50);
      });

      mockList.scrollToOffset.mockClear();

      // Rerender: pending is false so no additional scroll
      rerender({ count: 20 });

      expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    });

    it('does not scroll when itemCount stays 0 even if restore is pending', () => {
      const { result, rerender } = renderHook(
        ({ count }: { count: number }) => useScrollRestoration(count),
        { initialProps: { count: 0 } }
      );

      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(150));
      });

      // Rerender with 0 items — should not scroll
      rerender({ count: 0 });

      expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears the pending timer on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useScrollRestoration(0));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('does not scroll after unmount', () => {
      const { result, unmount } = renderHook(() => useScrollRestoration(0));
      const mockList = makeMockList();
      result.current.listRef.current = mockList;

      act(() => {
        result.current.handleScroll(makeScrollEvent(200));
      });

      unmount();

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    });
  });
});
