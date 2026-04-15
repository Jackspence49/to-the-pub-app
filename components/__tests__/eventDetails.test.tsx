// components/__tests__/eventDetails.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import EventDetails from '../eventDetails';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({
  FontAwesome: 'FontAwesome',
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: 'IconSymbol',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseProps = {
  title: 'Trivia Night',
  dateLabel: 'Saturday, April 19',
  startTimeLabel: '8:00 PM',
  endTimeLabel: '10:00 PM',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventDetails', () => {
  describe('rendering', () => {
    it('renders the event title', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.getByText('Trivia Night')).toBeTruthy();
    });

    it('renders the date label', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.getByText('Saturday, April 19')).toBeTruthy();
    });

    it('renders the start time', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.getByText('8:00 PM')).toBeTruthy();
    });

    it('renders the end time', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.getByText('10:00 PM')).toBeTruthy();
    });

    it('renders "Start time TBD" when startTimeLabel is absent but endTimeLabel is set', () => {
      render(<EventDetails {...baseProps} startTimeLabel={undefined} endTimeLabel="10:00 PM" />);
      expect(screen.getByText('Start time TBD')).toBeTruthy();
    });

    it('renders "End time TBD" when endTimeLabel is absent but startTimeLabel is set', () => {
      render(<EventDetails {...baseProps} startTimeLabel="8:00 PM" endTimeLabel={undefined} />);
      expect(screen.getByText('End time TBD')).toBeTruthy();
    });

    it('renders "Time coming soon" for both when neither time label is set', () => {
      render(<EventDetails {...baseProps} startTimeLabel={undefined} endTimeLabel={undefined} />);
      const labels = screen.getAllByText('Time coming soon');
      expect(labels.length).toBe(2);
    });

    it('renders the tag pill when tagLabel is set', () => {
      render(<EventDetails {...baseProps} tagLabel="Trivia" />);
      expect(screen.getByText('Trivia')).toBeTruthy();
    });

    it('does not render the tag pill when tagLabel is absent', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.queryByText('Trivia')).toBeNull();
    });

    it('renders the recurrence badge when recurrencePattern is set', () => {
      render(<EventDetails {...baseProps} recurrencePattern="weekly" />);
      expect(screen.getByText('Repeats weekly')).toBeTruthy();
    });

    it('does not render the recurrence badge when recurrencePattern is absent', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.queryByText(/Repeats/)).toBeNull();
    });

    it('renders the location label when locationLabel is set', () => {
      render(<EventDetails {...baseProps} locationLabel="The Tap" />);
      expect(screen.getByText('The Tap')).toBeTruthy();
    });

    it('does not render the venue row when locationLabel is absent', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.queryByText('The Tap')).toBeNull();
    });

    it('renders the address label when addressLabel is set', () => {
      render(<EventDetails {...baseProps} addressLabel="123 Main St, Boston, MA" />);
      expect(screen.getByText('123 Main St, Boston, MA')).toBeTruthy();
    });

    it('renders the "Get Directions" button when onPressOpenMap is provided with an address', () => {
      render(
        <EventDetails
          {...baseProps}
          addressLabel="123 Main St"
          onPressOpenMap={jest.fn()}
        />
      );
      expect(screen.getByText('Get Directions')).toBeTruthy();
    });

    it('does not render "Get Directions" when onPressOpenMap is absent', () => {
      render(<EventDetails {...baseProps} addressLabel="123 Main St" />);
      expect(screen.queryByText('Get Directions')).toBeNull();
    });

    it('renders the description when provided', () => {
      render(<EventDetails {...baseProps} description="Come test your knowledge!" />);
      expect(screen.getByText('Come test your knowledge!')).toBeTruthy();
    });

    it('does not render the About section when description is absent', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.queryByText('About')).toBeNull();
    });

    it('renders action buttons in the Contact & Links section', () => {
      const buttons = [
        { key: 'phone', label: 'Call', iconName: 'phone' as const, onPress: jest.fn() },
        { key: 'globe', label: 'Website', iconName: 'globe' as const, onPress: jest.fn() },
      ];
      render(<EventDetails {...baseProps} actionButtons={buttons} />);
      expect(screen.getByText('Call')).toBeTruthy();
      expect(screen.getByText('Website')).toBeTruthy();
    });

    it('does not render Contact & Links when showActionSection is false', () => {
      const buttons = [
        { key: 'phone', label: 'Call', iconName: 'phone' as const, onPress: jest.fn() },
      ];
      render(<EventDetails {...baseProps} actionButtons={buttons} showActionSection={false} />);
      expect(screen.queryByText('Contact & Links')).toBeNull();
      expect(screen.queryByText('Call')).toBeNull();
    });

    it('does not render Contact & Links when actionButtons is empty', () => {
      render(<EventDetails {...baseProps} actionButtons={[]} />);
      expect(screen.queryByText('Contact & Links')).toBeNull();
    });

    it('renders the "See all upcoming events" button', () => {
      render(<EventDetails {...baseProps} />);
      expect(screen.getByText('See all upcoming events')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onPressLocation when the venue row is pressed', () => {
      const onPressLocation = jest.fn();
      render(<EventDetails {...baseProps} locationLabel="The Tap" onPressLocation={onPressLocation} />);
      fireEvent.press(screen.getByText('The Tap'));
      expect(onPressLocation).toHaveBeenCalledTimes(1);
    });

    it('calls onPressOpenMap when "Get Directions" is pressed', () => {
      const onPressOpenMap = jest.fn();
      render(
        <EventDetails
          {...baseProps}
          addressLabel="123 Main St"
          onPressOpenMap={onPressOpenMap}
        />
      );
      fireEvent.press(screen.getByText('Get Directions'));
      expect(onPressOpenMap).toHaveBeenCalledTimes(1);
    });

    it('calls onPressViewBarEvents when "See all upcoming events" is pressed', () => {
      const onPressViewBarEvents = jest.fn();
      render(<EventDetails {...baseProps} onPressViewBarEvents={onPressViewBarEvents} />);
      fireEvent.press(screen.getByText('See all upcoming events'));
      expect(onPressViewBarEvents).toHaveBeenCalledTimes(1);
    });

    it('calls the action button onPress when tapped', () => {
      const onPress = jest.fn();
      const buttons = [{ key: 'phone', label: 'Call', iconName: 'phone' as const, onPress }];
      render(<EventDetails {...baseProps} actionButtons={buttons} />);
      fireEvent.press(screen.getByText('Call'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
