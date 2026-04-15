// components/__tests__/barTagFilterSheet.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TagFilterSheet } from '../barTagFilterSheet';
import type { TagFilterOption } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTag = (overrides: Partial<TagFilterOption> = {}): TagFilterOption => ({
  id: 'tag-1',
  name: 'Trivia',
  normalizedName: 'trivia',
  ...overrides,
});

const defaultProps = {
  visible: true,
  tags: [] as TagFilterOption[],
  selectedTags: [] as string[],
  onApply: jest.fn(),
  onClose: jest.fn(),
  theme: 'light' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagFilterSheet', () => {
  describe('rendering', () => {
    it('renders the sheet title', () => {
      render(<TagFilterSheet {...defaultProps} />);
      expect(screen.getByText('Bar Tags')).toBeTruthy();
    });

    it('renders empty state when no tags are provided', () => {
      render(<TagFilterSheet {...defaultProps} tags={[]} />);
      expect(screen.getByText('No tags available.')).toBeTruthy();
    });

    it('renders category headers for each tag group', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia', category: 'Games' }),
        makeTag({ id: 't2', name: 'Karaoke', category: 'Music' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      expect(screen.getByText('Games')).toBeTruthy();
      expect(screen.getByText('Music')).toBeTruthy();
    });

    it('renders uncategorised tags under the "Other" category', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: undefined })];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      expect(screen.getByText('Other')).toBeTruthy();
    });

    it('does not render individual tags when categories are collapsed', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      expect(screen.queryByText('Trivia')).toBeNull();
    });

    it('renders the Clear All and Apply Filters buttons', () => {
      render(<TagFilterSheet {...defaultProps} />);
      expect(screen.getByText('Clear All')).toBeTruthy();
      expect(screen.getByText('Apply Filters')).toBeTruthy();
    });

    it('shows a badge count when selectedTags includes tags from a category', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia', category: 'Games' }),
        makeTag({ id: 't2', name: 'Darts', category: 'Games' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} selectedTags={['t1', 't2']} />);
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('does not show a badge when no tags in the category are selected', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} selectedTags={[]} />);
      expect(screen.queryByText('1')).toBeNull();
    });

    it('sorts categories alphabetically with Other last', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Pool', category: 'Sports' }),
        makeTag({ id: 't2', name: 'Trivia', category: undefined }),
        makeTag({ id: 't3', name: 'Karaoke', category: 'Music' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      const allText = screen.getAllByText(/Music|Sports|Other/).map((el) => el.props.children);
      expect(allText).toEqual(['Music', 'Sports', 'Other']);
    });
  });

  describe('category expand / collapse', () => {
    it('reveals tags when a category header is pressed', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      fireEvent.press(screen.getByText('Games'));
      expect(screen.getByText('Trivia')).toBeTruthy();
    });

    it('hides tags again when the same category header is pressed twice', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      fireEvent.press(screen.getByText('Games'));
      fireEvent.press(screen.getByText('Games'));
      expect(screen.queryByText('Trivia')).toBeNull();
    });

    it('can expand multiple categories independently', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia', category: 'Games' }),
        makeTag({ id: 't2', name: 'Karaoke', category: 'Music' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      fireEvent.press(screen.getByText('Games'));
      fireEvent.press(screen.getByText('Music'));
      expect(screen.getByText('Trivia')).toBeTruthy();
      expect(screen.getByText('Karaoke')).toBeTruthy();
    });
  });

  describe('tag selection', () => {
    it('marks a tag as checked when tapped', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} />);
      fireEvent.press(screen.getByText('Games'));
      fireEvent.press(screen.getByText('Trivia'));
      // Badge of 1 confirms the tag entered the draft selection
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('unchecks a tag that is already selected when tapped', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(<TagFilterSheet {...defaultProps} tags={tags} selectedTags={['t1']} />);
      fireEvent.press(screen.getByText('Games'));
      fireEvent.press(screen.getByText('Trivia'));
      // After unchecking, badge count should disappear
      expect(screen.queryByText('1')).toBeNull();
    });

    it('initialises draft selection from selectedTags prop', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia', category: 'Games' }),
        makeTag({ id: 't2', name: 'Darts', category: 'Games' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} selectedTags={['t1']} />);
      // Badge of 1 confirms draft was seeded from the prop
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  describe('Clear All', () => {
    it('removes all draft selections when Clear All is pressed', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia', category: 'Games' }),
        makeTag({ id: 't2', name: 'Darts', category: 'Games' }),
      ];
      render(<TagFilterSheet {...defaultProps} tags={tags} selectedTags={['t1', 't2']} />);
      expect(screen.getByText('2')).toBeTruthy();
      fireEvent.press(screen.getByText('Clear All'));
      expect(screen.queryByText('2')).toBeNull();
    });
  });

  describe('Apply Filters', () => {
    it('calls onApply with the current draft selection and then onClose', () => {
      const onApply = jest.fn();
      const onClose = jest.fn();
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(
        <TagFilterSheet
          {...defaultProps}
          tags={tags}
          selectedTags={['t1']}
          onApply={onApply}
          onClose={onClose}
        />
      );
      fireEvent.press(screen.getByText('Apply Filters'));
      expect(onApply).toHaveBeenCalledWith(['t1']);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onApply with an empty array after Clear All then Apply', () => {
      const onApply = jest.fn();
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      render(
        <TagFilterSheet
          {...defaultProps}
          tags={tags}
          selectedTags={['t1']}
          onApply={onApply}
          onClose={jest.fn()}
        />
      );
      fireEvent.press(screen.getByText('Clear All'));
      fireEvent.press(screen.getByText('Apply Filters'));
      expect(onApply).toHaveBeenCalledWith([]);
    });
  });

  describe('close behaviour', () => {
    it('calls onClose when the scrim is pressed', () => {
      const onClose = jest.fn();
      render(<TagFilterSheet {...defaultProps} onClose={onClose} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Close filter sheet' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility', () => {
    it('does not render sheet content when visible is false', () => {
      render(<TagFilterSheet {...defaultProps} visible={false} />);
      expect(screen.queryByText('Bar Tags')).toBeNull();
    });

    it('resets draft selection to selectedTags when sheet becomes visible', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia', category: 'Games' })];
      const { rerender } = render(
        <TagFilterSheet {...defaultProps} tags={tags} visible={false} selectedTags={[]} />
      );
      // Open the sheet with a pre-selected tag
      rerender(
        <TagFilterSheet {...defaultProps} tags={tags} visible={true} selectedTags={['t1']} />
      );
      expect(screen.getByText('1')).toBeTruthy();
    });
  });
});
