// components/__tests__/barCard.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BarCard } from '../barCard';
import type { Bar } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOpenExternalLink = jest.fn();
const mockToSocialUrl = jest.fn((handle: string, platform: string) => `https://${platform}.com/${handle}`);
const mockFormatDistanceLabel = jest.fn<string | null, [number?]>(() => '0.5 mi');
const mockFormatCityAddress = jest.fn<string | null, [string?, string?]>(() => 'Boston, MA');

jest.mock('../../utils/helpers', () => ({
  openExternalLink: (url?: string) => mockOpenExternalLink(url),
  toSocialUrl: (handle: string, platform: string) => mockToSocialUrl(handle, platform),
  formatDistanceLabel: (miles?: number) => mockFormatDistanceLabel(miles),
  formatCityAddress: (city?: string, state?: string) => mockFormatCityAddress(city, state),
}));

jest.mock('@expo/vector-icons', () => ({
  FontAwesome: 'FontAwesome',
  MaterialIcons: 'MaterialIcons',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBar = (overrides: Partial<Bar> = {}): Bar => ({
  id: '1',
  name: 'The Tap',
  address_city: 'Boston',
  address_state: 'MA',
  distance_miles: 0.5,
  closes_at: '23:00',
  tags: [],
  hours: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFormatDistanceLabel.mockReturnValue('0.5 mi');
  mockFormatCityAddress.mockReturnValue('Boston, MA');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BarCard', () => {
  describe('rendering', () => {
    it('renders the bar name', () => {
      render(<BarCard bar={makeBar()} />);
      expect(screen.getByText('The Tap')).toBeTruthy();
    });

    it('renders the address label from formatCityAddress', () => {
      render(<BarCard bar={makeBar()} />);
      expect(screen.getByText('Boston, MA')).toBeTruthy();
    });

    it('renders distance label when formatDistanceLabel returns a value', () => {
      render(<BarCard bar={makeBar()} />);
      expect(screen.getByText(/0\.5 mi/)).toBeTruthy();
    });

    it('renders closing time when closes_at is set', () => {
      render(<BarCard bar={makeBar({ closes_at: '23:00' })} />);
      expect(screen.getByText(/Closes/)).toBeTruthy();
    });

    it('omits distance row when formatDistanceLabel returns null and closes_at is absent', () => {
      mockFormatDistanceLabel.mockReturnValue(null);
      render(<BarCard bar={makeBar({ closes_at: undefined })} />);
      expect(screen.queryByText(/mi/)).toBeNull();
      expect(screen.queryByText(/Closes/)).toBeNull();
    });

    it('renders tags up to 4', () => {
      const tags = [1, 2, 3, 4, 5].map(i => ({ id: `t${i}`, name: `Tag${i}` }));
      render(<BarCard bar={makeBar({ tags })} />);
      expect(screen.getByText('Tag1')).toBeTruthy();
      expect(screen.getByText('Tag4')).toBeTruthy();
      expect(screen.queryByText('Tag5')).toBeNull();
    });

    it('does not render tag list when tags is empty', () => {
      render(<BarCard bar={makeBar({ tags: [] })} />);
      expect(screen.queryByText('Tag1')).toBeNull();
    });

    it('renders instagram button when instagram handle is set', () => {
      render(<BarCard bar={makeBar({ instagram: 'thetap' })} />);
      expect(screen.getByTestId('social-instagram')).toBeTruthy();
    });

    it('renders twitter button when twitter handle is set', () => {
      render(<BarCard bar={makeBar({ twitter: 'thetap' })} />);
      expect(screen.getByTestId('social-twitter')).toBeTruthy();
    });

    it('renders facebook button when facebook handle is set', () => {
      render(<BarCard bar={makeBar({ facebook: 'thetap' })} />);
      expect(screen.getByTestId('social-facebook')).toBeTruthy();
    });

    it('does not render social row when no handles are set', () => {
      render(<BarCard bar={makeBar()} />);
      expect(screen.queryByTestId('social-instagram')).toBeNull();
      expect(screen.queryByTestId('social-twitter')).toBeNull();
      expect(screen.queryByTestId('social-facebook')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onPress when the card is tapped', () => {
      const onPress = jest.fn();
      render(<BarCard bar={makeBar()} onPress={onPress} />);
      fireEvent.press(screen.getByText('The Tap'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onPress is not provided', () => {
      expect(() => {
        render(<BarCard bar={makeBar()} />);
        fireEvent.press(screen.getByText('The Tap'));
      }).not.toThrow();
    });

    it('calls openExternalLink with instagram URL when instagram button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://instagram.com/thetap');
      render(<BarCard bar={makeBar({ instagram: 'thetap' })} />);
      fireEvent.press(screen.getByTestId('social-instagram'));
      expect(mockOpenExternalLink).toHaveBeenCalledWith('https://instagram.com/thetap');
    });

    it('calls openExternalLink with twitter URL when twitter button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://twitter.com/thetap');
      render(<BarCard bar={makeBar({ twitter: 'thetap' })} />);
      fireEvent.press(screen.getByTestId('social-twitter'));
      expect(mockOpenExternalLink).toHaveBeenCalledWith('https://twitter.com/thetap');
    });

    it('calls openExternalLink with facebook URL when facebook button is pressed', () => {
      mockToSocialUrl.mockReturnValue('https://facebook.com/thetap');
      render(<BarCard bar={makeBar({ facebook: 'thetap' })} />);
      fireEvent.press(screen.getByTestId('social-facebook'));
      expect(mockOpenExternalLink).toHaveBeenCalledWith('https://facebook.com/thetap');
    });
  });
});
