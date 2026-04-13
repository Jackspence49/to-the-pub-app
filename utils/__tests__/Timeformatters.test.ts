import { parseTimeToken, formatClosingTimeLabel, getTodaysHours } from '../Timeformatters';
import { BarHours } from '../../types';

// ---------------------------------------------------------------------------
// parseTimeToken
// ---------------------------------------------------------------------------

describe('parseTimeToken', () => {
  it('returns null for undefined', () => {
    expect(parseTimeToken(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTimeToken('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseTimeToken('   ')).toBeNull();
  });

  it('parses a full ISO datetime string', () => {
    const result = parseTimeToken('2024-06-15T14:30:00');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it('parses "2:00 PM" correctly', () => {
    const result = parseTimeToken('2:00 PM');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(0);
  });

  it('parses "12:00 PM" (noon) correctly', () => {
    const result = parseTimeToken('12:00 PM');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(12);
  });

  it('parses "12:00 AM" (midnight) as hour 0', () => {
    const result = parseTimeToken('12:00 AM');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(0);
  });

  it('parses "11:30 pm" (case-insensitive)', () => {
    const result = parseTimeToken('11:30 pm');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(23);
    expect(result!.getMinutes()).toBe(30);
  });

  it('parses a bare hour with no meridian ("9")', () => {
    const result = parseTimeToken('9');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(9);
    expect(result!.getMinutes()).toBe(0);
  });

  it('returns null for an invalid time like "99:00 AM"', () => {
    expect(parseTimeToken('99:00 AM')).toBeNull();
  });

  it('returns null for a completely non-time string', () => {
    expect(parseTimeToken('not a time')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatClosingTimeLabel
// ---------------------------------------------------------------------------

describe('formatClosingTimeLabel', () => {
  it('returns null when closesAt is undefined', () => {
    expect(formatClosingTimeLabel(undefined)).toBeNull();
  });

  it('returns null when closesAt is empty string', () => {
    expect(formatClosingTimeLabel('')).toBeNull();
  });

  it('formats "2:00 PM" → "2 PM"', () => {
    expect(formatClosingTimeLabel('2:00 PM')).toBe('2 PM');
  });

  it('formats "11:30 pm" → "11:30 PM"', () => {
    expect(formatClosingTimeLabel('11:30 pm')).toBe('11:30 PM');
  });

  it('formats "12:00 AM" → "12 AM"', () => {
    expect(formatClosingTimeLabel('12:00 AM')).toBe('12 AM');
  });

  it('formats "12:00 PM" → "12 PM"', () => {
    expect(formatClosingTimeLabel('12:00 PM')).toBe('12 PM');
  });

  it('returns the raw string when it cannot be parsed', () => {
    expect(formatClosingTimeLabel('closing time')).toBe('closing time');
  });
});

// ---------------------------------------------------------------------------
// getTodaysHours
// ---------------------------------------------------------------------------

const makeHours = (overrides: Partial<BarHours> = {}): BarHours => ({
  id: '1',
  day_of_week: new Date().getDay(),
  open_time: '11:00:00',
  close_time: '23:00:00',
  is_closed: false,
  crosses_midnight: false,
  ...overrides,
});

describe('getTodaysHours', () => {
  it('returns isClosed:true when hours array is empty', () => {
    expect(getTodaysHours([])).toEqual({ open: null, close: null, isClosed: true });
  });

  it('returns isClosed:true when no entry matches today', () => {
    const otherDay = (new Date().getDay() + 1) % 7;
    const hours = [makeHours({ day_of_week: otherDay })];
    expect(getTodaysHours(hours)).toEqual({ open: null, close: null, isClosed: true });
  });

  it('returns isClosed:true when today\'s entry has is_closed:true', () => {
    const hours = [makeHours({ is_closed: true })];
    expect(getTodaysHours(hours)).toEqual({ open: null, close: null, isClosed: true });
  });

  it('returns formatted open/close times for a normal day', () => {
    const hours = [makeHours({ open_time: '11:00:00', close_time: '23:00:00' })];
    const result = getTodaysHours(hours);
    expect(result.isClosed).toBe(false);
    expect(result.open).toBe('11:00 AM');
    expect(result.close).toBe('11:00 PM');
  });

  it('formats midnight close (00:00:00) correctly', () => {
    const hours = [makeHours({ close_time: '00:00:00' })];
    const result = getTodaysHours(hours);
    expect(result.close).toBe('12:00 AM');
  });

  it('formats noon open (12:00:00) correctly', () => {
    const hours = [makeHours({ open_time: '12:00:00' })];
    const result = getTodaysHours(hours);
    expect(result.open).toBe('12:00 PM');
  });
});
