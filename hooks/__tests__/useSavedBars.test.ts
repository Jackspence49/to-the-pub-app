// hooks/__tests__/useSavedBars.test.ts
// Tests for the useSavedBars custom hook

import { renderHook, act } from '@testing-library/react-native';
import { useSavedBars } from '../useSavedBars';
import type { searchBar } from '../../types/index';
import { MAX_SAVED_BARS, SAVED_BARS_KEY } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBar = (id: string, name = `Bar ${id}`): searchBar => ({ id, name });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useSavedBars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with an empty savedBars array', async () => {
      const { result } = renderHook(() => useSavedBars());

      expect(result.current.savedBars).toEqual([]);

      await act(async () => {});
    });

    it('exposes saveBar, removeSavedBar, and clearSavedBars functions', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(typeof result.current.saveBar).toBe('function');
      expect(typeof result.current.removeSavedBar).toBe('function');
      expect(typeof result.current.clearSavedBars).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Loading from AsyncStorage on mount
  // -------------------------------------------------------------------------

  describe('loading from storage on mount', () => {
    it('reads savedBars from AsyncStorage using the correct key', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([makeBar('1')]));

      renderHook(() => useSavedBars());

      await act(async () => {});

      expect(mockGetItem).toHaveBeenCalledWith(SAVED_BARS_KEY);
    });

    it('populates savedBars from stored data', async () => {
      const stored = [makeBar('1'), makeBar('2')];
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toEqual(stored);
    });

    it('slices stored data to MAX_SAVED_BARS on load', async () => {
      const stored = Array.from({ length: MAX_SAVED_BARS + 5 }, (_, i) =>
        makeBar(String(i))
      );
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toHaveLength(MAX_SAVED_BARS);
    });

    it('leaves savedBars empty when storage returns null', async () => {
      mockGetItem.mockResolvedValue(null);

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toEqual([]);
    });

    it('ignores corrupted storage data without throwing', async () => {
      mockGetItem.mockResolvedValue('not-valid-json{{');

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toEqual([]);
    });

    it('ignores non-array storage values', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ id: '1' }));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // saveBar
  // -------------------------------------------------------------------------

  describe('saveBar', () => {
    it('prepends a new bar to the list', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.saveBar(makeBar('1'));
      });

      expect(result.current.savedBars[0].id).toBe('1');
    });

    it('moves an already-saved bar to the front on re-save', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.saveBar(makeBar('1'));
        result.current.saveBar(makeBar('2'));
      });

      await act(async () => {
        result.current.saveBar(makeBar('1'));
      });

      expect(result.current.savedBars[0].id).toBe('1');
      expect(result.current.savedBars).toHaveLength(2);
    });

    it('does not create duplicates when saving the same bar twice', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.saveBar(makeBar('1'));
      });
      await act(async () => {
        result.current.saveBar(makeBar('1'));
      });

      expect(result.current.savedBars.filter((b) => b.id === '1')).toHaveLength(1);
    });

    it('caps the list at MAX_SAVED_BARS', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        for (let i = 0; i < MAX_SAVED_BARS + 5; i++) {
          result.current.saveBar(makeBar(String(i)));
        }
      });

      expect(result.current.savedBars).toHaveLength(MAX_SAVED_BARS);
    });

    it('persists the updated list to AsyncStorage', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.saveBar(makeBar('42'));
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        SAVED_BARS_KEY,
        expect.stringContaining('"id":"42"')
      );
    });

    it('persists no more than MAX_SAVED_BARS entries', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        for (let i = 0; i < MAX_SAVED_BARS + 5; i++) {
          result.current.saveBar(makeBar(String(i)));
        }
      });

      const lastCall = mockSetItem.mock.calls.at(-1);
      const persisted = JSON.parse(lastCall[1]);
      expect(persisted).toHaveLength(MAX_SAVED_BARS);
    });
  });

  // -------------------------------------------------------------------------
  // removeSavedBar
  // -------------------------------------------------------------------------

  describe('removeSavedBar', () => {
    it('removes the bar with the given id', async () => {
      const stored = [makeBar('1'), makeBar('2'), makeBar('3')];
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.removeSavedBar('2');
      });

      expect(result.current.savedBars.map((b) => b.id)).toEqual(['1', '3']);
    });

    it('does nothing when the id is not found', async () => {
      const stored = [makeBar('1'), makeBar('2')];
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.removeSavedBar('999');
      });

      expect(result.current.savedBars).toHaveLength(2);
    });

    it('persists the updated list to AsyncStorage after removal', async () => {
      const stored = [makeBar('1'), makeBar('2')];
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.removeSavedBar('1');
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        SAVED_BARS_KEY,
        expect.not.stringContaining('"id":"1"')
      );
    });
  });

  // -------------------------------------------------------------------------
  // clearSavedBars
  // -------------------------------------------------------------------------

  describe('clearSavedBars', () => {
    it('empties the savedBars list', async () => {
      const stored = [makeBar('1'), makeBar('2')];
      mockGetItem.mockResolvedValue(JSON.stringify(stored));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      expect(result.current.savedBars).toHaveLength(2);

      await act(async () => {
        result.current.clearSavedBars();
      });

      expect(result.current.savedBars).toEqual([]);
    });

    it('calls AsyncStorage.removeItem with the correct key', async () => {
      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await act(async () => {
        result.current.clearSavedBars();
      });

      expect(mockRemoveItem).toHaveBeenCalledWith(SAVED_BARS_KEY);
    });
  });

  // -------------------------------------------------------------------------
  // AsyncStorage error resilience
  // -------------------------------------------------------------------------

  describe('AsyncStorage error resilience', () => {
    it('does not throw when setItem rejects during saveBar', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage full'));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await expect(
        act(async () => {
          result.current.saveBar(makeBar('1'));
        })
      ).resolves.not.toThrow();

      expect(result.current.savedBars[0].id).toBe('1');
    });

    it('does not throw when removeItem rejects during clearSavedBars', async () => {
      mockRemoveItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSavedBars());

      await act(async () => {});

      await expect(
        act(async () => {
          result.current.clearSavedBars();
        })
      ).resolves.not.toThrow();

      expect(result.current.savedBars).toEqual([]);
    });
  });
});
