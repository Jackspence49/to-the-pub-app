// components/__tests__/barDetails.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import BarDetails from '../barDetails';
import type { Bar, BarHours, BarTag } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOpenExternal = jest.fn();
const mockOpenPhone = jest.fn();
const mockToSocialUrl = jest.fn((handle: string, platform: string) => `https://${platform}.com/${handle}`);

jest.mock('../../utils/helpers', () => ({
  openExternal: (url?: string) => mockOpenExternal(url),
  openPhone: (phone?: string) => mockOpenPhone(phone),
  toSocialUrl: (handle: string, platform: string) => mockToSocialUrl(handle, platform),
}));

jest.mock('@expo/vector-icons', () => ({
  FontAwesome: 'FontAwesome',
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = (props: object) => <View testID="map-view" {...props} />;
  const Marker = (props: object) => <View testID="map-marker" {...props} />;
  return { __esModule: true, default: MapView, Marker };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeHours = (overrides: Partial<BarHours> = {}): BarHours => ({
  id: 'h1',
  day_of_week: 1,
  open_time: '17:00',
  close_time: '23:00',
  is_closed: false,
  crosses_midnight: false,
  ...overrides,
});

const makeTag = (overrides: Partial<BarTag> = {}): BarTag => ({
  id: 't1',
  name: 'Dive Bar',
  category: 'type',
  ...overrides,
});

const makeBar = (overrides: Partial<Bar> = {}): Bar => ({
  id: '1',
  name: 'The Tap',
  address_street: '123 Main St',
  address_city: 'Boston',
  address_state: 'MA',
  address_zip: '02101',
  tags: [],
  hours: [],
  ...overrides,
});

const defaultProps = {
  isLoading: false,
  error: null,
  onRetry: jest.fn(),
  onViewUpcomingEvents: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BarDetails', () => {
  describe('loading state', () => {
    it('renders loading indicator when isLoading is true', () => {
      render(<BarDetails {...defaultProps} bar={null} isLoading={true} />);
      expect(screen.getByText('Loading bar details...')).toBeTruthy();
    });

    it('does not render bar content while loading', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} isLoading={true} />);
      expect(screen.queryByText('The Tap')).toBeNull();
    });
  });

  describe('error state', () => {
    it('renders error title when error is set', () => {
      render(<BarDetails {...defaultProps} bar={null} error="Something went wrong" />);
      expect(screen.getByText('Unable to load bar')).toBeTruthy();
    });

    it('renders the error message', () => {
      render(<BarDetails {...defaultProps} bar={null} error="Network failure" />);
      expect(screen.getByText('Network failure')).toBeTruthy();
    });

    it('calls onRetry when Try again is pressed', () => {
      const onRetry = jest.fn();
      render(<BarDetails {...defaultProps} bar={null} error="Oops" onRetry={onRetry} />);
      fireEvent.press(screen.getByText('Try again'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('null bar (no error, not loading)', () => {
    it('renders fallback error UI when bar is null', () => {
      render(<BarDetails {...defaultProps} bar={null} />);
      expect(screen.getByText('Unable to load bar')).toBeTruthy();
      expect(screen.getByText('Something went wrong loading this bar.')).toBeTruthy();
    });

    it('calls onRetry from the null-bar fallback', () => {
      const onRetry = jest.fn();
      render(<BarDetails {...defaultProps} bar={null} onRetry={onRetry} />);
      fireEvent.press(screen.getByText('Try again'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('bar name and description', () => {
    it('renders the bar name', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.getByText('The Tap')).toBeTruthy();
    });

    it('renders description when present', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ description: 'A cozy dive bar.' })} />);
      expect(screen.getByText('A cozy dive bar.')).toBeTruthy();
    });

    it('does not render description when absent', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ description: undefined })} />);
      expect(screen.queryByText('A cozy dive bar.')).toBeNull();
    });
  });

  describe('address', () => {
    it('renders Location section when address fields are present', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.getByText('Location')).toBeTruthy();
      expect(screen.getByText('123 Main St, Boston, MA 02101')).toBeTruthy();
    });

    it('omits Location section when no address fields are set', () => {
      render(
        <BarDetails
          {...defaultProps}
          bar={makeBar({ address_street: undefined, address_city: undefined, address_state: undefined, address_zip: undefined })}
        />,
      );
      expect(screen.queryByText('Location')).toBeNull();
    });

    it('renders Get Directions button when address is present', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.getByText('Get Directions')).toBeTruthy();
    });
  });

  describe('tags', () => {
    it('renders type tags above the bar name', () => {
      const tags = [makeTag({ id: 't1', name: 'Dive Bar', category: 'type' })];
      render(<BarDetails {...defaultProps} bar={makeBar({ tags })} />);
      expect(screen.getByText('Dive Bar')).toBeTruthy();
    });

    it('renders amenity tags as pills', () => {
      const tags = [makeTag({ id: 't2', name: 'Pool Table', category: 'amenity' })];
      render(<BarDetails {...defaultProps} bar={makeBar({ tags })} />);
      expect(screen.getByText('Pool Table')).toBeTruthy();
    });

    it('renders multiple amenity tags', () => {
      const tags = [
        makeTag({ id: 't2', name: 'Pool Table', category: 'amenity' }),
        makeTag({ id: 't3', name: 'Live Music', category: 'amenity' }),
      ];
      render(<BarDetails {...defaultProps} bar={makeBar({ tags })} />);
      expect(screen.getByText('Pool Table')).toBeTruthy();
      expect(screen.getByText('Live Music')).toBeTruthy();
    });
  });

  describe('hours', () => {
    it('renders Hours section when hours are provided', () => {
      const hours = [makeHours({ day_of_week: 1, open_time: '17:00', close_time: '23:00' })];
      render(<BarDetails {...defaultProps} bar={makeBar({ hours })} />);
      expect(screen.getByText('Hours')).toBeTruthy();
    });

    it('shows Closed for closed hours', () => {
      const hours = [makeHours({ day_of_week: 0, is_closed: true })];
      render(<BarDetails {...defaultProps} bar={makeBar({ hours })} />);
      expect(screen.getByText('Closed')).toBeTruthy();
    });

    it('groups days with identical hours onto one row', () => {
      const hours = [
        makeHours({ id: 'h1', day_of_week: 1, open_time: '17:00', close_time: '23:00' }),
        makeHours({ id: 'h2', day_of_week: 2, open_time: '17:00', close_time: '23:00' }),
      ];
      render(<BarDetails {...defaultProps} bar={makeBar({ hours })} />);
      expect(screen.getByText('Mon - Tue')).toBeTruthy();
    });

    it('omits Hours section when hours array is empty', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ hours: [] })} />);
      expect(screen.queryByText('Hours')).toBeNull();
    });
  });

  describe('contact actions', () => {
    it('renders Contact section with Website when website is set', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ website: 'https://thetap.com' })} />);
      expect(screen.getByText('Contact')).toBeTruthy();
      expect(screen.getByText('Website')).toBeTruthy();
    });

    it('renders Call button when phone is set', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ phone: '6175550000' })} />);
      expect(screen.getByText('Call')).toBeTruthy();
    });

    it('calls openExternal with website URL when Website is pressed', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ website: 'https://thetap.com' })} />);
      fireEvent.press(screen.getByLabelText('Open The Tap website'));
      expect(mockOpenExternal).toHaveBeenCalledWith('https://thetap.com');
    });

    it('calls openPhone when Call is pressed', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ phone: '6175550000' })} />);
      fireEvent.press(screen.getByLabelText('Call The Tap'));
      expect(mockOpenPhone).toHaveBeenCalledWith('6175550000');
    });

    it('omits Contact section when no website or phone', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.queryByText('Contact')).toBeNull();
    });
  });

  describe('social actions', () => {
    it('renders Socials section when instagram is set', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ instagram: 'thetap' })} />);
      expect(screen.getByText('Socials')).toBeTruthy();
    });

    it('calls openExternal with instagram URL when instagram button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://instagram.com/thetap');
      render(<BarDetails {...defaultProps} bar={makeBar({ instagram: 'thetap' })} />);
      fireEvent.press(screen.getByLabelText('Open The Tap Instagram'));
      expect(mockOpenExternal).toHaveBeenCalledWith('https://instagram.com/thetap');
    });

    it('calls openExternal with facebook URL when facebook button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://facebook.com/thetap');
      render(<BarDetails {...defaultProps} bar={makeBar({ facebook: 'thetap' })} />);
      fireEvent.press(screen.getByLabelText('Open The Tap Facebook'));
      expect(mockOpenExternal).toHaveBeenCalledWith('https://facebook.com/thetap');
    });

    it('calls openExternal with twitter URL when twitter button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://twitter.com/thetap');
      render(<BarDetails {...defaultProps} bar={makeBar({ twitter: 'thetap' })} />);
      fireEvent.press(screen.getByLabelText('Open The Tap Twitter'));
      expect(mockOpenExternal).toHaveBeenCalledWith('https://twitter.com/thetap');
    });

    it('omits Socials section when no social handles are set', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.queryByText('Socials')).toBeNull();
    });
  });

  describe('upcoming events', () => {
    it('renders See upcoming events button', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.getByText('See upcoming events')).toBeTruthy();
    });

    it('calls onViewUpcomingEvents when button is pressed', () => {
      const onViewUpcomingEvents = jest.fn();
      render(<BarDetails {...defaultProps} bar={makeBar()} onViewUpcomingEvents={onViewUpcomingEvents} />);
      fireEvent.press(screen.getByText('See upcoming events'));
      expect(onViewUpcomingEvents).toHaveBeenCalledTimes(1);
    });
  });

  describe('map', () => {
    it('renders MapView when lat/lng are provided', () => {
      render(<BarDetails {...defaultProps} bar={makeBar({ latitude: 42.3555, longitude: -71.0565 })} />);
      expect(screen.getByTestId('map-view')).toBeTruthy();
    });

    it('does not render MapView when coordinates are missing', () => {
      render(<BarDetails {...defaultProps} bar={makeBar()} />);
      expect(screen.queryByTestId('map-view')).toBeNull();
    });
  });
});
