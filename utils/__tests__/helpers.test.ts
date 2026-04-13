import {
  buildQueryString,
  extractBarItems,
  toNumber,
  formatDistanceLabel,
  ensureProtocol,
  normalizeTwitterUrl,
  toSocialUrl,
  getCacheKey,
  formatCityAddress,
  formatEventDay,
  formatEventTime,
  openExternalLink,
  openExternal,
  openPhone,
} from '../helpers';

// ---------------------------------------------------------------------------
// Mock react-native Linking
// ---------------------------------------------------------------------------

const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: (...args: unknown[]) => mockCanOpenURL(...args),
    openURL: (...args: unknown[]) => mockOpenURL(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// buildQueryString
// ---------------------------------------------------------------------------

describe('buildQueryString', () => {
  it('returns empty string for empty params', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('builds a simple query string', () => {
    expect(buildQueryString({ foo: 'bar', baz: '1' })).toBe('foo=bar&baz=1');
  });

  it('encodes special characters', () => {
    expect(buildQueryString({ q: 'hello world' })).toBe('q=hello%20world');
  });

  it('filters out undefined values', () => {
    expect(buildQueryString({ a: 'x', b: undefined })).toBe('a=x');
  });

  it('filters out empty string values', () => {
    expect(buildQueryString({ a: 'x', b: '' })).toBe('a=x');
  });

  it('coerces numeric values to strings', () => {
    expect(buildQueryString({ page: 2 })).toBe('page=2');
  });
});

// ---------------------------------------------------------------------------
// extractBarItems
// ---------------------------------------------------------------------------

describe('extractBarItems', () => {
  it('returns [] for null/undefined', () => {
    expect(extractBarItems(null)).toEqual([]);
    expect(extractBarItems(undefined)).toEqual([]);
  });

  it('returns [] for non-object primitives', () => {
    expect(extractBarItems(42)).toEqual([]);
    expect(extractBarItems('string')).toEqual([]);
  });

  it('returns the array directly when payload is an array', () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(extractBarItems(items)).toEqual(items);
  });

  it('extracts from payload.data.data', () => {
    const items = [{ id: 1 }];
    expect(extractBarItems({ data: { data: items } })).toEqual(items);
  });

  it('extracts from payload.data when it is an array', () => {
    const items = [{ id: 1 }];
    expect(extractBarItems({ data: items })).toEqual(items);
  });

  it('returns [] when neither candidate is an array', () => {
    expect(extractBarItems({ data: { meta: 'info' } })).toEqual([]);
  });

  it('prefers data.data over data when both are arrays', () => {
    const inner = [{ id: 'inner' }];
    const outer = [{ id: 'outer' }];
    expect(extractBarItems({ data: { data: inner } })).toEqual(inner);
    // outer array directly — no wrapping needed for this case
    expect(extractBarItems({ data: outer })).toEqual(outer);
  });
});

// ---------------------------------------------------------------------------
// toNumber
// ---------------------------------------------------------------------------

describe('toNumber', () => {
  it('returns a finite number as-is', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-3.14)).toBe(-3.14);
  });

  it('returns undefined for Infinity', () => {
    expect(toNumber(Infinity)).toBeUndefined();
  });

  it('returns undefined for NaN', () => {
    expect(toNumber(NaN)).toBeUndefined();
  });

  it('parses numeric strings', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('3.14')).toBe(3.14);
    expect(toNumber('0')).toBe(0);
  });

  it('returns undefined for non-numeric strings', () => {
    expect(toNumber('abc')).toBeUndefined();
  });

  it('returns undefined for null, undefined, objects, booleans', () => {
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber({})).toBeUndefined();
    expect(toNumber(true)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatDistanceLabel
// ---------------------------------------------------------------------------

describe('formatDistanceLabel', () => {
  it('returns null for undefined', () => {
    expect(formatDistanceLabel(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(formatDistanceLabel(NaN)).toBeNull();
  });

  it('returns null for negative distances', () => {
    expect(formatDistanceLabel(-1)).toBeNull();
  });

  it('returns "Right here" for 0', () => {
    expect(formatDistanceLabel(0)).toBe('Right here');
  });

  it('returns feet for distances under 0.1 mi', () => {
    expect(formatDistanceLabel(0.05)).toBe(`${(0.05 * 5280).toFixed(0)} ft away`);
  });

  it('returns 2-decimal miles for distances under 10 mi', () => {
    expect(formatDistanceLabel(5)).toBe('5.00 mi away');
  });

  it('returns 1-decimal miles for distances 10–99 mi', () => {
    expect(formatDistanceLabel(50)).toBe('50.0 mi away');
  });

  it('returns whole miles for distances >= 100 mi', () => {
    expect(formatDistanceLabel(150)).toBe('150 mi away');
  });
});

// ---------------------------------------------------------------------------
// ensureProtocol
// ---------------------------------------------------------------------------

describe('ensureProtocol', () => {
  it('leaves https:// URLs unchanged', () => {
    expect(ensureProtocol('https://example.com')).toBe('https://example.com');
  });

  it('leaves http:// URLs unchanged', () => {
    expect(ensureProtocol('http://example.com')).toBe('http://example.com');
  });

  it('prepends https:// when missing', () => {
    expect(ensureProtocol('example.com')).toBe('https://example.com');
  });
});

// ---------------------------------------------------------------------------
// normalizeTwitterUrl
// ---------------------------------------------------------------------------

describe('normalizeTwitterUrl', () => {
  it('returns undefined for null', () => {
    expect(normalizeTwitterUrl(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(normalizeTwitterUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for empty/whitespace string', () => {
    expect(normalizeTwitterUrl('')).toBeUndefined();
    expect(normalizeTwitterUrl('   ')).toBeUndefined();
  });

  it('returns a full https URL as-is', () => {
    expect(normalizeTwitterUrl('https://x.com/foo')).toBe('https://x.com/foo');
  });

  it('adds protocol to a bare twitter.com URL', () => {
    expect(normalizeTwitterUrl('twitter.com/foo')).toBe('https://twitter.com/foo');
  });

  it('adds protocol to a bare x.com URL', () => {
    expect(normalizeTwitterUrl('x.com/foo')).toBe('https://x.com/foo');
  });

  it('converts @handle to full x.com URL', () => {
    expect(normalizeTwitterUrl('@johndoe')).toBe('https://x.com/johndoe');
  });

  it('converts bare handle to full x.com URL', () => {
    expect(normalizeTwitterUrl('johndoe')).toBe('https://x.com/johndoe');
  });

  it('returns undefined for a lone @ with no handle', () => {
    expect(normalizeTwitterUrl('@')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toSocialUrl
// ---------------------------------------------------------------------------

describe('toSocialUrl', () => {
  it('returns full https URL unchanged', () => {
    expect(toSocialUrl('https://instagram.com/user', 'instagram')).toBe('https://instagram.com/user');
  });

  it('returns full http URL unchanged', () => {
    expect(toSocialUrl('http://instagram.com/user', 'instagram')).toBe('http://instagram.com/user');
  });

  it('prepends known platform base URL for a username', () => {
    expect(toSocialUrl('mypage', 'facebook')).toBe('https://facebook.com/mypage');
  });

  it('strips leading @ from username', () => {
    expect(toSocialUrl('@tweetuser', 'twitter')).toBe('https://x.com/tweetuser');
  });

  it('uses https://username for unknown platform', () => {
    expect(toSocialUrl('somehandle', 'tiktok')).toBe('https://somehandle');
  });
});

// ---------------------------------------------------------------------------
// getCacheKey
// ---------------------------------------------------------------------------

describe('getCacheKey', () => {
  it('builds a key from coords and sorted tags', () => {
    expect(getCacheKey({ lat: 42, lon: -71 }, ['beer', 'ale'])).toBe('42|-71|ale,beer');
  });

  it('handles empty tags', () => {
    expect(getCacheKey({ lat: 42, lon: -71 }, [])).toBe('42|-71|');
  });

  it('appends radius when provided', () => {
    expect(getCacheKey({ lat: 42, lon: -71 }, ['ale'], 5)).toBe('42|-71|ale|r5');
  });

  it('omits radius key when undefined', () => {
    expect(getCacheKey({ lat: 42, lon: -71 }, [], undefined)).toBe('42|-71|');
  });

  it('sorts tags before joining', () => {
    const a = getCacheKey({ lat: 1, lon: 2 }, ['z', 'a', 'm']);
    const b = getCacheKey({ lat: 1, lon: 2 }, ['a', 'm', 'z']);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// formatCityAddress
// ---------------------------------------------------------------------------

describe('formatCityAddress', () => {
  it('returns null when both are undefined', () => {
    expect(formatCityAddress()).toBeNull();
  });

  it('returns city alone when state is undefined', () => {
    expect(formatCityAddress('Boston')).toBe('Boston');
  });

  it('returns state alone when city is undefined', () => {
    expect(formatCityAddress(undefined, 'MA')).toBe('MA');
  });

  it('joins city and state with ", "', () => {
    expect(formatCityAddress('Boston', 'MA')).toBe('Boston, MA');
  });
});

// ---------------------------------------------------------------------------
// formatEventDay
// ---------------------------------------------------------------------------

describe('formatEventDay', () => {
  it('returns fallback for undefined', () => {
    expect(formatEventDay(undefined)).toBe('Date coming soon');
  });

  it('returns fallback for empty string', () => {
    expect(formatEventDay('')).toBe('Date coming soon');
  });

  it('returns fallback for invalid date string', () => {
    expect(formatEventDay('not-a-date')).toBe('Date coming soon');
  });

  it('returns a non-empty string for a valid ISO datetime', () => {
    // Use a datetime (not date-only) to avoid UTC midnight timezone issues
    const result = formatEventDay('2024-06-15T12:00:00');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('Date coming soon');
  });
});

// ---------------------------------------------------------------------------
// formatEventTime
// ---------------------------------------------------------------------------

describe('formatEventTime', () => {
  it('returns null for undefined', () => {
    expect(formatEventTime(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatEventTime('')).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(formatEventTime('not-a-time')).toBeNull();
  });

  it('returns a formatted time for HH:MM format', () => {
    const result = formatEventTime('14:30');
    expect(result).not.toBeNull();
    expect(result).toMatch(/2:30\s*PM/i);
  });

  it('returns a formatted time for HH:MM:SS format', () => {
    const result = formatEventTime('09:00:00');
    expect(result).not.toBeNull();
    expect(result).toMatch(/9:00\s*AM/i);
  });
});

// ---------------------------------------------------------------------------
// openExternalLink
// ---------------------------------------------------------------------------

describe('openExternalLink', () => {
  it('does nothing when url is undefined', async () => {
    await openExternalLink(undefined);
    expect(mockCanOpenURL).not.toHaveBeenCalled();
  });

  it('opens the URL when canOpenURL returns true', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);

    await openExternalLink('https://example.com');

    expect(mockCanOpenURL).toHaveBeenCalledWith('https://example.com');
    expect(mockOpenURL).toHaveBeenCalledWith('https://example.com');
  });

  it('does not open when canOpenURL returns false', async () => {
    mockCanOpenURL.mockResolvedValue(false);

    await openExternalLink('https://example.com');

    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing', async () => {
    mockCanOpenURL.mockRejectedValue(new Error('fail'));

    await expect(openExternalLink('https://example.com')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// openExternal
// ---------------------------------------------------------------------------

describe('openExternal', () => {
  it('does nothing when url is undefined', async () => {
    await openExternal(undefined);
    expect(mockCanOpenURL).not.toHaveBeenCalled();
  });

  it('prepends https:// before checking', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);

    await openExternal('example.com');

    expect(mockCanOpenURL).toHaveBeenCalledWith('https://example.com');
    expect(mockOpenURL).toHaveBeenCalledWith('https://example.com');
  });

  it('swallows errors without throwing', async () => {
    mockCanOpenURL.mockRejectedValue(new Error('fail'));

    await expect(openExternal('https://example.com')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// openPhone
// ---------------------------------------------------------------------------

describe('openPhone', () => {
  it('does nothing when phone is undefined', async () => {
    await openPhone(undefined);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('does nothing when phone has no digits', async () => {
    await openPhone('---');
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('strips non-digit characters and dials', async () => {
    mockOpenURL.mockResolvedValue(undefined);

    await openPhone('(617) 555-1234');

    expect(mockOpenURL).toHaveBeenCalledWith('tel:6175551234');
  });

  it('preserves leading + for international numbers', async () => {
    mockOpenURL.mockResolvedValue(undefined);

    await openPhone('+1 617 555 1234');

    expect(mockOpenURL).toHaveBeenCalledWith('tel:+16175551234');
  });

  it('swallows errors without throwing', async () => {
    mockOpenURL.mockRejectedValue(new Error('dialer unavailable'));

    await expect(openPhone('6175551234')).resolves.toBeUndefined();
  });
});
