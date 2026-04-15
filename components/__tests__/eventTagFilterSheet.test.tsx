// components/__tests__/eventTagFilterSheet.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EventTagFilterSheet } from '../eventTagFilterSheet';
import type { EventTag } from '../../types';

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

const makeTag = (overrides: Partial<EventTag> = {}): EventTag => ({
  id: 'tag-1',
  name: 'Trivia',
  ...overrides,
});

const defaultProps = {
  visible: true,
  tags: [] as EventTag[],
  selectedTagIds: [] as string[],
  onApply: jest.fn(),
  onClose: jest.fn(),
  isLoading: false,
  error: null,
  theme: 'light' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventTagFilterSheet', () => {
  describe('rendering', () => {
    it('renders the sheet title', () => {
      render(<EventTagFilterSheet {...defaultProps} />);
      expect(screen.getByText('Filter Events')).toBeTruthy();
    });

    it('renders empty state when no tags are provided', () => {
      render(<EventTagFilterSheet {...defaultProps} tags={[]} />);
      expect(screen.getByText('No tags available.')).toBeTruthy();
    });

    it('renders all tag rows', () => {
      const tags = [
        makeTag({ id: 't1', name: 'Trivia' }),
        makeTag({ id: 't2', name: 'Karaoke' }),
      ];
      render(<EventTagFilterSheet {...defaultProps} tags={tags} />);
      expect(screen.getByText('Trivia')).toBeTruthy();
      expect(screen.getByText('Karaoke')).toBeTruthy();
    });

    it('marks a selected tag with the selected accessibility state', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia' })];
      render(<EventTagFilterSheet {...defaultProps} tags={tags} selectedTagIds={['t1']} />);
      expect(screen.getByRole('radio', { selected: true })).toBeTruthy();
    });

    it('marks an unselected tag with selected: false', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia' })];
      render(<EventTagFilterSheet {...defaultProps} tags={tags} selectedTagIds={[]} />);
      expect(screen.getByRole('radio', { selected: false })).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('shows a loading indicator when isLoading is true', () => {
      render(<EventTagFilterSheet {...defaultProps} isLoading={true} />);
      expect(screen.getByText('Loading tags...')).toBeTruthy();
    });

    it('does not render tag rows while loading', () => {
      const tags = [makeTag({ id: 't1', name: 'Trivia' })];
      render(<EventTagFilterSheet {...defaultProps} tags={tags} isLoading={true} />);
      expect(screen.queryByText('Trivia')).toBeNull();
    });
  });

  describe('error state', () => {
    it('shows the error message when error is set', () => {
      render(<EventTagFilterSheet {...defaultProps} error="Failed to load tags" />);
      expect(screen.getByText('Failed to load tags')).toBeTruthy();
    });

    it('renders a Retry button when onRetry is provided', () => {
      render(
        <EventTagFilterSheet
          {...defaultProps}
          error="Network error"
          onRetry={jest.fn()}
        />
      );
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('does not render a Retry button when onRetry is not provided', () => {
      render(<EventTagFilterSheet {...defaultProps} error="Network error" />);
      expect(screen.queryByText('Retry')).toBeNull();
    });

    it('calls onRetry when the Retry button is pressed', () => {
      const onRetry = jest.fn();
      render(
        <EventTagFilterSheet
          {...defaultProps}
          error="Network error"
          onRetry={onRetry}
        />
      );
      fireEvent.press(screen.getByText('Retry'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('tag selection (single-select)', () => {
    it('calls onApply with the tapped tag id and then calls onClose', () => {
      const onApply = jest.fn();
      const onClose = jest.fn();
      const tags = [makeTag({ id: 't1', name: 'Trivia' })];
      render(
        <EventTagFilterSheet
          {...defaultProps}
          tags={tags}
          onApply={onApply}
          onClose={onClose}
        />
      );
      fireEvent.press(screen.getByText('Trivia'));
      expect(onApply).toHaveBeenCalledWith(['t1']);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('deselects the tag (calls onApply with []) when the already-selected tag is tapped', () => {
      const onApply = jest.fn();
      const onClose = jest.fn();
      const tags = [makeTag({ id: 't1', name: 'Trivia' })];
      render(
        <EventTagFilterSheet
          {...defaultProps}
          tags={tags}
          selectedTagIds={['t1']}
          onApply={onApply}
          onClose={onClose}
        />
      );
      fireEvent.press(screen.getByText('Trivia'));
      expect(onApply).toHaveBeenCalledWith([]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('replaces the current selection when a different tag is tapped', () => {
      const onApply = jest.fn();
      const tags = [
        makeTag({ id: 't1', name: 'Trivia' }),
        makeTag({ id: 't2', name: 'Karaoke' }),
      ];
      render(
        <EventTagFilterSheet
          {...defaultProps}
          tags={tags}
          selectedTagIds={['t1']}
          onApply={onApply}
          onClose={jest.fn()}
        />
      );
      fireEvent.press(screen.getByText('Karaoke'));
      expect(onApply).toHaveBeenCalledWith(['t2']);
    });
  });

  describe('close behaviour', () => {
    it('calls onClose when the scrim is pressed', () => {
      const onClose = jest.fn();
      render(<EventTagFilterSheet {...defaultProps} onClose={onClose} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Close filter sheet' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility', () => {
    it('does not render sheet content when visible is false', () => {
      render(<EventTagFilterSheet {...defaultProps} visible={false} />);
      expect(screen.queryByText('Filter Events')).toBeNull();
    });
  });
});
