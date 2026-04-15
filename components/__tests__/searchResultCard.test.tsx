// components/__tests__/searchResultCard.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SearchResultCard } from '../searchResultCard';
import type { searchBar } from '../../types/index';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockBar: searchBar = {
  id: '1',
  name: 'The Crown',
  address_city: 'Boston',
  address_state: 'MA',
};

const defaultProps = {
  bar: mockBar,
  theme: 'light' as const,
  onPress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchResultCard', () => {
  describe('rendering', () => {
    it('renders the bar name', () => {
      render(<SearchResultCard {...defaultProps} />);
      expect(screen.getByText('The Crown')).toBeTruthy();
    });

    it('renders city and state joined with a comma', () => {
      render(<SearchResultCard {...defaultProps} />);
      expect(screen.getByText('Boston, MA')).toBeTruthy();
    });

    it('renders only city when state is absent', () => {
      const bar: searchBar = { id: '2', name: 'Bar', address_city: 'Cambridge' };
      render(<SearchResultCard {...defaultProps} bar={bar} />);
      expect(screen.getByText('Cambridge')).toBeTruthy();
    });

    it('renders only state when city is absent', () => {
      const bar: searchBar = { id: '3', name: 'Bar', address_state: 'MA' };
      render(<SearchResultCard {...defaultProps} bar={bar} />);
      expect(screen.getByText('MA')).toBeTruthy();
    });

    it('renders fallback text when both city and state are absent', () => {
      const bar: searchBar = { id: '4', name: 'Bar' };
      render(<SearchResultCard {...defaultProps} bar={bar} />);
      expect(screen.getByText('Location coming soon')).toBeTruthy();
    });

    it('has the correct accessibility label on the card', () => {
      render(<SearchResultCard {...defaultProps} />);
      expect(
        screen.UNSAFE_getByProps({ accessibilityLabel: 'Open The Crown' })
      ).toBeTruthy();
    });

    it('does not render a remove button when onRemove is not provided', () => {
      render(<SearchResultCard {...defaultProps} />);
      expect(
        screen.UNSAFE_queryAllByProps({ accessibilityLabel: 'Remove The Crown from recents' })
      ).toHaveLength(0);
    });
  });

  describe('remove button', () => {
    it('renders the remove button when onRemove is provided', () => {
      const onRemove = jest.fn();
      render(<SearchResultCard {...defaultProps} onRemove={onRemove} />);
      expect(
        screen.UNSAFE_getByProps({ accessibilityLabel: 'Remove The Crown from recents' })
      ).toBeTruthy();
    });

    it('calls onRemove when the remove button is pressed', () => {
      const onRemove = jest.fn();
      render(<SearchResultCard {...defaultProps} onRemove={onRemove} />);
      fireEvent.press(
        screen.UNSAFE_getByProps({ accessibilityLabel: 'Remove The Crown from recents' })
      );
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when the remove button is pressed', () => {
      const onPress = jest.fn();
      const onRemove = jest.fn();
      render(<SearchResultCard {...defaultProps} onPress={onPress} onRemove={onRemove} />);
      fireEvent.press(
        screen.UNSAFE_getByProps({ accessibilityLabel: 'Remove The Crown from recents' })
      );
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('press behaviour', () => {
    it('calls onPress when the card is pressed', () => {
      const onPress = jest.fn();
      render(<SearchResultCard {...defaultProps} onPress={onPress} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Open The Crown' }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
