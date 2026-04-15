// components/__tests__/eventCard.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import EventCard from '../eventCard';
import type { Event } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFormatEventTime = jest.fn<string | null, [string?]>(() => '8:00 PM');

jest.mock('../../utils/helpers', () => ({
  formatEventTime: (time?: string) => mockFormatEventTime(time),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  instance_id: 'inst-1',
  title: 'Trivia Night',
  bar_name: 'The Tap',
  start_time: '20:00',
  end_time: '22:00',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFormatEventTime.mockReturnValue('8:00 PM');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventCard', () => {
  describe('rendering', () => {
    it('renders the event title', () => {
      render(<EventCard event={makeEvent()} />);
      expect(screen.getByText('Trivia Night')).toBeTruthy();
    });

    it('renders the bar name', () => {
      render(<EventCard event={makeEvent()} />);
      expect(screen.getByText('The Tap')).toBeTruthy();
    });

    it('renders "Unknown venue" when bar_name is absent', () => {
      render(<EventCard event={makeEvent({ bar_name: undefined })} />);
      expect(screen.getByText('Unknown venue')).toBeTruthy();
    });

    it('renders the formatted start and end times', () => {
      mockFormatEventTime.mockReturnValue('8:00 PM');
      render(<EventCard event={makeEvent()} />);
      const timeValues = screen.getAllByText('8:00 PM');
      expect(timeValues.length).toBe(2);
    });

    it('renders "Time TBD" for start when formatEventTime returns null', () => {
      mockFormatEventTime.mockReturnValue(null);
      render(<EventCard event={makeEvent({ start_time: undefined, end_time: undefined })} />);
      const tbd = screen.getAllByText('Time TBD');
      expect(tbd.length).toBe(2);
    });

    it('renders the event tag pill when event_tag_name is set', () => {
      render(<EventCard event={makeEvent({ event_tag_name: 'Trivia' })} />);
      expect(screen.getByText('Trivia')).toBeTruthy();
    });

    it('does not render the event tag pill when event_tag_name is absent', () => {
      render(<EventCard event={makeEvent({ event_tag_name: undefined })} />);
      expect(screen.queryByText('Trivia')).toBeNull();
    });

    it('renders the distance pill when distanceMiles is a valid number', () => {
      render(<EventCard event={makeEvent({ distanceMiles: 1.2 })} />);
      expect(screen.getByText(/1\.2.*away/)).toBeTruthy();
    });

    it('renders "< 0.1 miles away" when distanceMiles is less than 0.1', () => {
      render(<EventCard event={makeEvent({ distanceMiles: 0.05 })} />);
      expect(screen.getByText(/< 0\.1.*away/)).toBeTruthy();
    });

    it('does not render distance pill when distanceMiles is undefined', () => {
      render(<EventCard event={makeEvent({ distanceMiles: undefined })} />);
      expect(screen.queryByText(/away/)).toBeNull();
    });

    it('does not render distance pill when distanceMiles is negative', () => {
      render(<EventCard event={makeEvent({ distanceMiles: -1 })} />);
      expect(screen.queryByText(/away/)).toBeNull();
    });

    it('respects a custom distanceUnit', () => {
      render(<EventCard event={makeEvent({ distanceMiles: 2 })} distanceUnit="km" />);
      expect(screen.getByText(/2.*km.*away/)).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onPress when the card is tapped', () => {
      const onPress = jest.fn();
      render(<EventCard event={makeEvent()} onPress={onPress} />);
      fireEvent.press(screen.getByText('Trivia Night'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onPress is not provided', () => {
      expect(() => {
        render(<EventCard event={makeEvent()} />);
        fireEvent.press(screen.getByText('Trivia Night'));
      }).not.toThrow();
    });
  });
});
