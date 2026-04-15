// components/__tests__/radiusSelector.test.tsx

import React from 'react';
import { View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RadiusSelector } from '../radiusSelector';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// measureInWindow is a no-op in the test environment; make it fire the callback
// so that handleOpen can set picker state and show the dropdown.
beforeAll(() => {
  View.prototype.measureInWindow = jest.fn().mockImplementation((cb) => cb(0, 0, 160, 48));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  value: 5,
  onChange: jest.fn(),
  theme: 'light' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RadiusSelector', () => {
  describe('rendering', () => {
    it('renders the current radius value as a label', () => {
      render(<RadiusSelector {...defaultProps} />);
      expect(screen.getByText('Radius: 5 mi')).toBeTruthy();
    });

    it('has the correct accessibility label on the trigger button', () => {
      render(<RadiusSelector {...defaultProps} />);
      expect(
        screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' })
      ).toBeTruthy();
    });

    it('does not show the dropdown by default', () => {
      render(<RadiusSelector {...defaultProps} />);
      expect(screen.queryByText('1 miles')).toBeNull();
    });
  });

  describe('opening the dropdown', () => {
    it('shows all radius options after the trigger is pressed', () => {
      render(<RadiusSelector {...defaultProps} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      expect(screen.getByText('1 miles')).toBeTruthy();
      expect(screen.getByText('3 miles')).toBeTruthy();
      expect(screen.getByText('5 miles')).toBeTruthy();
      expect(screen.getByText('10 miles')).toBeTruthy();
    });

    it('closes the dropdown when the trigger is pressed while open', () => {
      render(<RadiusSelector {...defaultProps} />);
      const trigger = screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' });
      fireEvent.press(trigger);
      expect(screen.getByText('1 miles')).toBeTruthy();
      fireEvent.press(trigger);
      expect(screen.queryByText('1 miles')).toBeNull();
    });

    it('closes the dropdown when the backdrop is pressed', () => {
      render(<RadiusSelector {...defaultProps} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      expect(screen.getByText('1 miles')).toBeTruthy();
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Close radius selector' }));
      expect(screen.queryByText('1 miles')).toBeNull();
    });
  });

  describe('selecting an option', () => {
    it('calls onChange with the selected value', () => {
      const onChange = jest.fn();
      render(<RadiusSelector {...defaultProps} onChange={onChange} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      fireEvent.press(screen.getByText('10 miles'));
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('closes the dropdown after selecting an option', () => {
      render(<RadiusSelector {...defaultProps} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      fireEvent.press(screen.getByText('3 miles'));
      expect(screen.queryByText('1 miles')).toBeNull();
    });

    it('calls onChange exactly once per selection', () => {
      const onChange = jest.fn();
      render(<RadiusSelector {...defaultProps} onChange={onChange} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      fireEvent.press(screen.getByText('1 miles'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('option accessibility labels', () => {
    it('each option has an accessibility label matching its value in miles', () => {
      render(<RadiusSelector {...defaultProps} />);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityLabel: 'Search radius: 5 mi. Tap to change.' }));
      expect(screen.UNSAFE_getByProps({ accessibilityLabel: '1 miles' })).toBeTruthy();
      expect(screen.UNSAFE_getByProps({ accessibilityLabel: '10 miles' })).toBeTruthy();
    });
  });
});
