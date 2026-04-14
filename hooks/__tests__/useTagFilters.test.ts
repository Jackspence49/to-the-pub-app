// hooks/__tests__/useTagFilters.test.ts
// Tests for the useTagFilters custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useState } from 'react';
import { useTagFilters } from '../useTagFilters';
import type { Bar } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTag = (id: string, name = `Tag ${id}`, category?: string) => ({
  id,
  name,
  ...(category ? { category } : {}),
});

const makeBar = (id: string, tagIds: string[] = []): Bar => ({
  id,
  name: `Bar ${id}`,
  tags: tagIds.map((tid) => ({ id: tid, name: `Tag ${tid}` })),
  hours: [],
});

const stubTagsFetch = (tags: unknown[], status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(tags),
  } as Response);

const stubTagsFetchWrapped = (tags: unknown[], status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ data: tags }),
  } as Response);

/** Renders the hook with its own internal state for selectedTags and isFilterSheetVisible. */
const renderTagFilters = (
  initialBars: Bar[] = [],
  initialTags: string[] = [],
  initialSheetVisible = false
) =>
  renderHook(() => {
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
    const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(initialSheetVisible);
    return useTagFilters(
      initialBars,
      selectedTags,
      setSelectedTags,
      isFilterSheetVisible,
      setIsFilterSheetVisible
    );
  });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useTagFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with empty availableTags before fetch resolves', () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderTagFilters();

      expect(result.current.availableTags).toEqual([]);
    });

    it('starts with areTagsLoading true before fetch resolves', () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderTagFilters();

      expect(result.current.areTagsLoading).toBe(true);
    });

    it('starts with no tags error', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).toBeNull();
    });

    it('reflects the initial selectedTags passed in', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag1', 'tag2']);
      await act(async () => {});

      expect(result.current.selectedTags).toEqual(['tag1', 'tag2']);
    });

    it('reflects the initial isFilterSheetVisible passed in', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], [], true);
      await act(async () => {});

      expect(result.current.isFilterSheetVisible).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // fetchTags — success paths
  // -------------------------------------------------------------------------

  describe('fetchTags — success', () => {
    it('populates availableTags from a raw array response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Karaoke'), makeTag('2', 'Quiz Night')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(2);
    });

    it('populates availableTags from a { data: [...] } response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetchWrapped([makeTag('1', 'Karaoke'), makeTag('2', 'Quiz Night')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(2);
    });

    it('sorts availableTags alphabetically by name', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('2', 'Trivia'), makeTag('1', 'Karaoke'), makeTag('3', 'Darts')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags.map((t) => t.name)).toEqual([
        'Darts',
        'Karaoke',
        'Trivia',
      ]);
    });

    it('sets areTagsLoading to false after fetch resolves', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.areTagsLoading).toBe(false);
    });

    it('keeps tagsError null on success', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([makeTag('1')]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).toBeNull();
    });

    it('preserves tag category when provided', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Karaoke', 'Entertainment')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags[0].category).toBe('Entertainment');
    });
  });

  // -------------------------------------------------------------------------
  // fetchTags — normalisation
  // -------------------------------------------------------------------------

  describe('fetchTags — normalisation', () => {
    it('deduplicates tags by id', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Karaoke'), makeTag('1', 'Karaoke duplicate')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(1);
      expect(result.current.availableTags[0].name).toBe('Karaoke');
    });

    it('skips tags with no id', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([{ name: 'No ID Tag' }, makeTag('1', 'Valid')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(1);
      expect(result.current.availableTags[0].id).toBe('1');
    });

    it('skips tags with no name', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([{ id: '1' }, makeTag('2', 'Valid')])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(1);
      expect(result.current.availableTags[0].id).toBe('2');
    });

    it('trims whitespace from tag ids and names', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([{ id: ' 1 ', name: ' Karaoke ' }])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags[0].id).toBe('1');
      expect(result.current.availableTags[0].name).toBe('Karaoke');
    });

    it('accepts numeric tag ids by converting them to strings', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([{ id: 42, name: 'Pool Tables' }])
      );

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags[0].id).toBe('42');
    });

    it('handles an empty payload gracefully', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // fetchTags — error paths
  // -------------------------------------------------------------------------

  describe('fetchTags — error handling', () => {
    it('sets tagsError on a non-ok HTTP response', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([], 500));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).toContain('500');
      expect(result.current.areTagsLoading).toBe(false);
    });

    it('sets tagsError on a network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).toBe('Network error');
      expect(result.current.areTagsLoading).toBe(false);
    });

    it('sets a generic tagsError message on an unknown error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue('unexpected non-Error thrown');

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).toBe('Unable to load tags right now.');
    });

    it('clears availableTags on error', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubTagsFetch([makeTag('1', 'Karaoke')]))
        .mockRejectedValue(new Error('Network error'));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags).toHaveLength(1);

      await act(async () => {
        result.current.retryFetchTags();
      });

      expect(result.current.availableTags).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // retryFetchTags
  // -------------------------------------------------------------------------

  describe('retryFetchTags', () => {
    it('triggers a re-fetch of tags', async () => {
      (global.fetch as jest.Mock)
        .mockReturnValueOnce(stubTagsFetch([makeTag('1', 'Karaoke')]))
        .mockReturnValue(stubTagsFetch([makeTag('2', 'Trivia')]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.availableTags[0].id).toBe('1');

      await act(async () => {
        result.current.retryFetchTags();
      });

      expect(result.current.availableTags[0].id).toBe('2');
    });

    it('clears tagsError on a successful retry', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockReturnValue(stubTagsFetch([makeTag('1')]));

      const { result } = renderTagFilters();
      await act(async () => {});

      expect(result.current.tagsError).not.toBeNull();

      await act(async () => {
        result.current.retryFetchTags();
      });

      expect(result.current.tagsError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // filteredBars
  // -------------------------------------------------------------------------

  describe('filteredBars', () => {
    it('returns all bars when no tags are selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));
      const bars = [makeBar('1', ['tag1']), makeBar('2', [])];

      const { result } = renderTagFilters(bars, []);
      await act(async () => {});

      expect(result.current.filteredBars).toHaveLength(2);
    });

    it('returns bars that have the selected tag', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));
      const bars = [makeBar('1', ['tag1']), makeBar('2', ['tag2'])];

      const { result } = renderTagFilters(bars, ['tag1']);
      await act(async () => {});

      expect(result.current.filteredBars).toHaveLength(1);
      expect(result.current.filteredBars[0].id).toBe('1');
    });

    it('applies AND logic — bar must have ALL selected tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));
      const bars = [
        makeBar('1', ['tag1', 'tag2']),
        makeBar('2', ['tag1']),
        makeBar('3', ['tag2']),
      ];

      const { result } = renderTagFilters(bars, ['tag1', 'tag2']);
      await act(async () => {});

      expect(result.current.filteredBars).toHaveLength(1);
      expect(result.current.filteredBars[0].id).toBe('1');
    });

    it('excludes bars with no tags when a filter is active', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));
      const bars = [makeBar('1', []), makeBar('2', ['tag1'])];

      const { result } = renderTagFilters(bars, ['tag1']);
      await act(async () => {});

      expect(result.current.filteredBars).toHaveLength(1);
      expect(result.current.filteredBars[0].id).toBe('2');
    });

    it('returns empty array when no bars match the selected tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));
      const bars = [makeBar('1', ['tag1']), makeBar('2', ['tag2'])];

      const { result } = renderTagFilters(bars, ['tag3']);
      await act(async () => {});

      expect(result.current.filteredBars).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // selectedTagEntries
  // -------------------------------------------------------------------------

  describe('selectedTagEntries', () => {
    it('returns empty array when no tags are selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([makeTag('1', 'Karaoke')]));

      const { result } = renderTagFilters([], []);
      await act(async () => {});

      expect(result.current.selectedTagEntries).toEqual([]);
    });

    it('returns { normalized, label } pairs for selected tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(
        stubTagsFetch([makeTag('1', 'Karaoke'), makeTag('2', 'Trivia')])
      );

      const { result } = renderTagFilters([], ['1', '2']);
      await act(async () => {});

      expect(result.current.selectedTagEntries).toEqual([
        { normalized: '1', label: 'Karaoke' },
        { normalized: '2', label: 'Trivia' },
      ]);
    });

    it('falls back to the raw id as label when tag is not in availableTags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['unknown-id']);
      await act(async () => {});

      expect(result.current.selectedTagEntries).toEqual([
        { normalized: 'unknown-id', label: 'unknown-id' },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // handleApplyFilters
  // -------------------------------------------------------------------------

  describe('handleApplyFilters', () => {
    it('updates selectedTags with the provided ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters(['tag1', 'tag2']);
      });

      expect(result.current.selectedTags).toEqual(['tag1', 'tag2']);
    });

    it('trims whitespace from ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters([' tag1 ', 'tag2 ']);
      });

      expect(result.current.selectedTags).toEqual(['tag1', 'tag2']);
    });

    it('filters out empty and whitespace-only ids', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters(['tag1', '', '   ']);
      });

      expect(result.current.selectedTags).toEqual(['tag1']);
    });

    it('accepts an empty array to clear all tags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag1', 'tag2']);
      await act(async () => {});

      act(() => {
        result.current.handleApplyFilters([]);
      });

      expect(result.current.selectedTags).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // handleClearFilters
  // -------------------------------------------------------------------------

  describe('handleClearFilters', () => {
    it('empties selectedTags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag1', 'tag2']);
      await act(async () => {});

      act(() => {
        result.current.handleClearFilters();
      });

      expect(result.current.selectedTags).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // handleRemoveTag
  // -------------------------------------------------------------------------

  describe('handleRemoveTag', () => {
    it('removes the specified tag from selectedTags', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag1', 'tag2']);
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('tag1');
      });

      expect(result.current.selectedTags).toEqual(['tag2']);
    });

    it('is a no-op when the tag is not selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag2']);
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('tag1');
      });

      expect(result.current.selectedTags).toEqual(['tag2']);
    });

    it('removes only the specified tag when multiple are selected', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], ['tag1', 'tag2', 'tag3']);
      await act(async () => {});

      act(() => {
        result.current.handleRemoveTag('tag2');
      });

      expect(result.current.selectedTags).toEqual(['tag1', 'tag3']);
    });
  });

  // -------------------------------------------------------------------------
  // Filter sheet visibility
  // -------------------------------------------------------------------------

  describe('filter sheet visibility', () => {
    it('openFilterSheet sets isFilterSheetVisible to true', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters();
      await act(async () => {});

      act(() => {
        result.current.openFilterSheet();
      });

      expect(result.current.isFilterSheetVisible).toBe(true);
    });

    it('closeFilterSheet sets isFilterSheetVisible to false', async () => {
      (global.fetch as jest.Mock).mockReturnValue(stubTagsFetch([]));

      const { result } = renderTagFilters([], [], true);
      await act(async () => {});

      act(() => {
        result.current.closeFilterSheet();
      });

      expect(result.current.isFilterSheetVisible).toBe(false);
    });
  });
});
