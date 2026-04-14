// hooks/__tests__/useEventTagFilters.test.ts
// Tests for the useEventTagFilters custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useEventTagFilters } from '../useEventTagFilters';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../utils/Eventmappers', () => ({
  extractTagItems: jest.fn((payload: unknown) => (Array.isArray(payload) ? payload : [])),
  mapToEventTag: jest.fn((raw: { id?: string; name?: string }) => ({
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTag = (id: string, name = `Tag ${id}`) => ({ id, name });

const stubTagsFetch = (tags: unknown[], status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(tags),
  } as Response);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useEventTagFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with empty selectedTagIds when no initialTagIds provided', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.selectedTagIds).toEqual([]);
    });

    it('uses the provided initialTagIds on first render', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters(['quiz', 'trivia']));
      await act(async () => {});

      expect(result.current.selectedTagIds).toEqual(['quiz', 'trivia']);
    });

    it('starts with filter sheet hidden', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.isFilterSheetVisible).toBe(false);
    });

    it('starts with no tags error', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.tagsError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // fetchAvailableTags — success
  // -------------------------------------------------------------------------

  describe('fetchAvailableTags', () => {
    it('populates availableTags on a successful response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Quiz Night'), makeTag('2', 'Trivia')])
      );

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(2);
      expect(result.current.availableTags[0].id).toBe('1');
      expect(result.current.availableTags[1].name).toBe('Trivia');
    });

    it('sets areTagsLoading false after fetch resolves', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.areTagsLoading).toBe(false);
    });

    it('keeps tagsError null on success', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([makeTag('1')]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.tagsError).toBeNull();
    });

    it('can be called manually to re-fetch', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubTagsFetch([makeTag('1')]))
        .mockReturnValue(stubTagsFetch([makeTag('2', 'New Tag')]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.availableTags[0].id).toBe('1');

      await act(async () => {
        result.current.fetchAvailableTags();
      });

      expect(result.current.availableTags[0].id).toBe('2');
    });
  });

  // -------------------------------------------------------------------------
  // fetchAvailableTags — error paths
  // -------------------------------------------------------------------------

  describe('fetchAvailableTags error handling', () => {
    it('sets tagsError on a non-ok HTTP response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([], 500));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.tagsError).toContain('500');
      expect(result.current.areTagsLoading).toBe(false);
    });

    it('sets tagsError on a network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.tagsError).toBe('Network error');
      expect(result.current.areTagsLoading).toBe(false);
    });

    it('sets a generic tagsError message on an unknown error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue('unexpected non-Error thrown');

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.tagsError).toBe('Unable to load event tags right now.');
      expect(result.current.areTagsLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // handleApplyFilters
  // -------------------------------------------------------------------------

  describe('handleApplyFilters', () => {
    it('updates selectedTagIds with the provided ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters(['quiz', 'trivia']);
      });

      expect(result.current.selectedTagIds).toEqual(['quiz', 'trivia']);
    });

    it('closes the filter sheet after applying', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.openFilterSheet();
      });
      expect(result.current.isFilterSheetVisible).toBe(true);

      act(() => {
        result.current.handleApplyFilters(['quiz']);
      });

      expect(result.current.isFilterSheetVisible).toBe(false);
    });

    it('deduplicates and trims ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters(['quiz', ' quiz', 'quiz']);
      });

      expect(result.current.selectedTagIds).toEqual(['quiz']);
    });

    it('filters out empty/whitespace-only ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters(['quiz', '', '   ']);
      });

      expect(result.current.selectedTagIds).toEqual(['quiz']);
    });
  });

  // -------------------------------------------------------------------------
  // handleRemoveTag
  // -------------------------------------------------------------------------

  describe('handleRemoveTag', () => {
    it('removes the specified tag from selectedTagIds', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters(['quiz', 'trivia']));
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('quiz');
      });

      expect(result.current.selectedTagIds).toEqual(['trivia']);
    });

    it('is a no-op when the tag is not selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters(['trivia']));
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('quiz');
      });

      expect(result.current.selectedTagIds).toEqual(['trivia']);
    });
  });

  // -------------------------------------------------------------------------
  // handleClearTags
  // -------------------------------------------------------------------------

  describe('handleClearTags', () => {
    it('empties selectedTagIds', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters(['quiz', 'trivia']));
      await act(async () => {});

      act(() => {
        result.current.handleClearTags();
      });

      expect(result.current.selectedTagIds).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Filter sheet visibility
  // -------------------------------------------------------------------------

  describe('filter sheet visibility', () => {
    it('openFilterSheet sets isFilterSheetVisible to true', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.openFilterSheet();
      });

      expect(result.current.isFilterSheetVisible).toBe(true);
    });

    it('closeFilterSheet sets isFilterSheetVisible to false', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      act(() => {
        result.current.openFilterSheet();
      });
      act(() => {
        result.current.closeFilterSheet();
      });

      expect(result.current.isFilterSheetVisible).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // selectedTagNames / selectedTagEntries derived state
  // -------------------------------------------------------------------------

  describe('derived state', () => {
    it('selectedTagNames returns names of selected tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Quiz Night'), makeTag('2', 'Trivia')])
      );

      const { result } = renderHook(() => useEventTagFilters(['1']));
      await act(async () => {});

      expect(result.current.selectedTagNames).toEqual(['Quiz Night']);
    });

    it('selectedTagNames is empty when no tags are selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Quiz Night')])
      );

      const { result } = renderHook(() => useEventTagFilters());
      await act(async () => {});

      expect(result.current.selectedTagNames).toEqual([]);
    });

    it('selectedTagEntries returns { normalized, label } pairs for selected tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Quiz Night'), makeTag('2', 'Trivia')])
      );

      const { result } = renderHook(() => useEventTagFilters(['1', '2']));
      await act(async () => {});

      expect(result.current.selectedTagEntries).toEqual([
        { normalized: '1', label: 'Quiz Night' },
        { normalized: '2', label: 'Trivia' },
      ]);
    });

    it('selectedTagEntries updates when a tag is removed', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Quiz Night'), makeTag('2', 'Trivia')])
      );

      const { result } = renderHook(() => useEventTagFilters(['1', '2']));
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('1');
      });

      expect(result.current.selectedTagEntries).toEqual([
        { normalized: '2', label: 'Trivia' },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // initialTagIds — applied once on mount
  // -------------------------------------------------------------------------

  describe('initialTagIds applied once', () => {
    it('does not re-apply initialTagIds when the prop reference changes', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      let initialIds = ['quiz'];
      const { result, rerender } = renderHook(() => useEventTagFilters(initialIds));
      await act(async () => {});

      act(() => {
        result.current.handleClearTags();
      });

      expect(result.current.selectedTagIds).toEqual([]);

      // Change the initial prop — should NOT override the cleared state
      initialIds = ['trivia'];
      rerender({});
      await act(async () => {});

      expect(result.current.selectedTagIds).toEqual([]);
    });
  });
});
