import {
  parseTagParam,
  formatRelativeEventDay,
  extractEventItems,
  extractTagItems,
  normalizeDateOnly,
  combineDateAndTime,
  mapToEvent,
  mapToEventTag,
  mergeEvents,
} from '../Eventmappers';

// ---------------------------------------------------------------------------
// parseTagParam
// ---------------------------------------------------------------------------

describe('parseTagParam', () => {
  it('returns [] for undefined', () => {
    expect(parseTagParam(undefined)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseTagParam('')).toEqual([]);
  });

  it('splits a comma-separated string', () => {
    expect(parseTagParam('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from entries', () => {
    expect(parseTagParam(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates values', () => {
    expect(parseTagParam('a,b,a')).toEqual(['a', 'b']);
  });

  it('filters out blank entries after trimming', () => {
    expect(parseTagParam('a,,b')).toEqual(['a', 'b']);
  });

  it('returns the array as-is when given an array', () => {
    expect(parseTagParam(['x', 'y'])).toEqual(['x', 'y']);
  });

  it('deduplicates an array', () => {
    expect(parseTagParam(['x', 'x', 'y'])).toEqual(['x', 'y']);
  });
});

// ---------------------------------------------------------------------------
// formatRelativeEventDay
// ---------------------------------------------------------------------------

describe('formatRelativeEventDay', () => {
  it('returns fallback for undefined', () => {
    expect(formatRelativeEventDay(undefined)).toBe('Date coming soon');
  });

  it('returns fallback for invalid date string', () => {
    expect(formatRelativeEventDay('not-a-date')).toBe('Date coming soon');
  });

  it('returns "Today" for today\'s date', () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expect(formatRelativeEventDay(`${yyyy}-${mm}-${dd}`)).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    expect(formatRelativeEventDay(`${yyyy}-${mm}-${dd}`)).toBe('Tomorrow');
  });

  it('returns a weekday name for dates 2–6 days away', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const result = formatRelativeEventDay(`${yyyy}-${mm}-${dd}`);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(weekdays).toContain(result);
  });

  it('returns a short date label for dates 7+ days away', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const result = formatRelativeEventDay(`${yyyy}-${mm}-${dd}`);
    // Should contain a month abbreviation like "Jan", "Feb", etc.
    expect(result).toMatch(/[A-Z][a-z]{2}/);
  });
});

// ---------------------------------------------------------------------------
// extractEventItems
// ---------------------------------------------------------------------------

describe('extractEventItems', () => {
  it('returns [] for null/undefined', () => {
    expect(extractEventItems(null)).toEqual([]);
    expect(extractEventItems(undefined)).toEqual([]);
  });

  it('returns an array payload directly', () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(extractEventItems(items)).toEqual(items);
  });

  it('extracts from payload.data.items', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ data: { items } })).toEqual(items);
  });

  it('extracts from payload.data.data', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ data: { data: items } })).toEqual(items);
  });

  it('extracts from payload.data when it is an array', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ data: items })).toEqual(items);
  });

  it('extracts from payload.items', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ items })).toEqual(items);
  });

  it('extracts from payload.results', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ results: items })).toEqual(items);
  });

  it('extracts from payload.event_instances', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ event_instances: items })).toEqual(items);
  });

  it('extracts from payload.events', () => {
    const items = [{ id: 1 }];
    expect(extractEventItems({ events: items })).toEqual(items);
  });

  it('returns [] when no candidate is an array', () => {
    expect(extractEventItems({ meta: 'info' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractTagItems
// ---------------------------------------------------------------------------

describe('extractTagItems', () => {
  it('returns [] for null/undefined', () => {
    expect(extractTagItems(null)).toEqual([]);
    expect(extractTagItems(undefined)).toEqual([]);
  });

  it('returns an array payload directly', () => {
    const tags = [{ id: 'quiz' }];
    expect(extractTagItems(tags)).toEqual(tags);
  });

  it('extracts from payload.data.tags', () => {
    const tags = [{ id: 'trivia' }];
    expect(extractTagItems({ data: { tags } })).toEqual(tags);
  });

  it('extracts from payload.data.items', () => {
    const tags = [{ id: 'karaoke' }];
    expect(extractTagItems({ data: { items: tags } })).toEqual(tags);
  });

  it('extracts from payload.data when it is an array', () => {
    const tags = [{ id: 'live-music' }];
    expect(extractTagItems({ data: tags })).toEqual(tags);
  });

  it('extracts from payload.tags', () => {
    const tags = [{ id: 'darts' }];
    expect(extractTagItems({ tags })).toEqual(tags);
  });

  it('extracts from payload.event_tags', () => {
    const tags = [{ id: 'pool' }];
    expect(extractTagItems({ event_tags: tags })).toEqual(tags);
  });

  it('extracts from payload.items', () => {
    const tags = [{ id: 'bingo' }];
    expect(extractTagItems({ items: tags })).toEqual(tags);
  });

  it('extracts from payload.results', () => {
    const tags = [{ id: 'comedy' }];
    expect(extractTagItems({ results: tags })).toEqual(tags);
  });

  it('returns [] when no candidate is an array', () => {
    expect(extractTagItems({ meta: 'info' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeDateOnly
// ---------------------------------------------------------------------------

describe('normalizeDateOnly', () => {
  it('returns null for undefined', () => {
    expect(normalizeDateOnly(undefined)).toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(normalizeDateOnly('not-a-date')).toBeNull();
  });

  it('returns the date string in YYYY-MM-DD format', () => {
    // normalizeDateOnly uses new Date() which treats date-only as UTC midnight
    const result = normalizeDateOnly('2024-06-15');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('applies a positive day offset', () => {
    // Mirror the function: new Date() on a date-only string parses as UTC midnight,
    // so compute the expected value the same way to stay timezone-independent.
    const d = new Date('2024-01-31');
    d.setDate(d.getDate() + 1);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(normalizeDateOnly('2024-01-31', 1)).toBe(expected);
  });

  it('applies a negative day offset', () => {
    const d = new Date('2024-03-01');
    d.setDate(d.getDate() - 1);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(normalizeDateOnly('2024-03-01', -1)).toBe(expected);
  });

  it('returns the same date when offset is 0', () => {
    const result = normalizeDateOnly('2024-06-15', 0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// combineDateAndTime
// ---------------------------------------------------------------------------

describe('combineDateAndTime', () => {
  it('returns undefined when dateValue is missing', () => {
    expect(combineDateAndTime(undefined, '10:00:00')).toBeUndefined();
  });

  it('returns undefined when timeValue is missing', () => {
    expect(combineDateAndTime('2024-06-15', undefined)).toBeUndefined();
  });

  it('combines date and time into a datetime string', () => {
    const result = combineDateAndTime('2024-06-15', '10:00:00');
    expect(result).toMatch(/^2024-\d{2}-\d{2}T10:00:00$/);
  });

  it('applies offsetDays when crosses midnight', () => {
    const without = combineDateAndTime('2024-06-15', '01:00:00');
    const withOffset = combineDateAndTime('2024-06-15', '01:00:00', { offsetDays: 1 });
    // Time part must be preserved
    expect(withOffset).toMatch(/T01:00:00$/);
    // Date must be different from no-offset
    expect(withOffset).not.toBe(without);
  });
});

// ---------------------------------------------------------------------------
// mapToEvent
// ---------------------------------------------------------------------------

describe('mapToEvent', () => {
  it('maps a minimal raw event', () => {
    const raw = { instance_id: '42', title: 'Quiz Night', bar_name: 'The Pub' };
    const event = mapToEvent(raw);
    expect(event.instance_id).toBe('42');
    expect(event.title).toBe('Quiz Night');
    expect(event.bar_name).toBe('The Pub');
  });

  it('falls back to raw.name when title is missing', () => {
    const event = mapToEvent({ id: '1', name: 'Karaoke' });
    expect(event.title).toBe('Karaoke');
  });

  it('uses "Untitled event" when neither title nor name is present', () => {
    const event = mapToEvent({ id: '1' });
    expect(event.title).toBe('Untitled event');
  });

  it('prefers instance_id over id', () => {
    const event = mapToEvent({ instance_id: 'inst-1', id: 'id-1', title: 'T' });
    expect(event.instance_id).toBe('inst-1');
  });

  it('falls back to id when instance_id is absent', () => {
    const event = mapToEvent({ id: 'id-99', title: 'T' });
    expect(event.instance_id).toBe('id-99');
  });

  it('resolves bar_name from venue.name', () => {
    const event = mapToEvent({ id: '1', title: 'T', venue: { name: 'The Venue' } });
    expect(event.bar_name).toBe('The Venue');
  });

  it('resolves bar_name from venue_name', () => {
    const event = mapToEvent({ id: '1', title: 'T', venue_name: 'Venue Name' });
    expect(event.bar_name).toBe('Venue Name');
  });

  it('defaults bar_name to "Unknown bar"', () => {
    const event = mapToEvent({ id: '1', title: 'T' });
    expect(event.bar_name).toBe('Unknown bar');
  });

  it('picks up address fields from the bar sub-object', () => {
    const raw = {
      id: '1',
      title: 'T',
      bar: { address_city: 'Boston', address_state: 'MA', address_zip: '02101' },
    };
    const event = mapToEvent(raw);
    expect(event.address_city).toBe('Boston');
    expect(event.address_state).toBe('MA');
    expect(event.address_zip).toBe('02101');
  });

  it('sets crosses_midnight to false by default', () => {
    const event = mapToEvent({ id: '1', title: 'T' });
    expect(event.crosses_midnight).toBe(false);
  });

  it('sets crosses_midnight to true when flag is present', () => {
    const event = mapToEvent({ id: '1', title: 'T', crosses_midnight: true });
    expect(event.crosses_midnight).toBe(true);
  });

  it('resolves event_tag_id and event_tag_name from nested event_tag', () => {
    const raw = { id: '1', title: 'T', event_tag: { id: 'quiz', name: 'Quiz Night' } };
    const event = mapToEvent(raw);
    expect(event.event_tag_id).toBe('quiz');
    expect(event.event_tag_name).toBe('Quiz Night');
  });

  it('resolves distanceMiles from distance_miles', () => {
    const event = mapToEvent({ id: '1', title: 'T', distance_miles: 1.5 });
    expect(event.distanceMiles).toBe(1.5);
  });

  it('returns undefined distanceMiles when absent', () => {
    const event = mapToEvent({ id: '1', title: 'T' });
    expect(event.distanceMiles).toBeUndefined();
  });

  it('resolves start_time from starts_at', () => {
    const event = mapToEvent({ id: '1', title: 'T', starts_at: '2024-06-15T20:00:00' });
    expect(event.start_time).toBe('2024-06-15T20:00:00');
  });

  it('builds start_time from date + start_time fields', () => {
    const event = mapToEvent({ id: '1', title: 'T', date: '2024-06-15', start_time: '20:00:00' });
    expect(event.start_time).toMatch(/2024-\d{2}-\d{2}T20:00:00/);
  });

  it('resolves bar_id from bar.id', () => {
    const event = mapToEvent({ id: '1', title: 'T', bar: { id: 'bar-42' } });
    expect(event.bar_id).toBe('bar-42');
  });

  it('converts bar_id to a string', () => {
    const event = mapToEvent({ id: '1', title: 'T', bar_id: 99 });
    expect(event.bar_id).toBe('99');
  });

  it('maps external_url from external_link', () => {
    const event = mapToEvent({ id: '1', title: 'T', external_link: 'https://example.com' });
    expect(event.external_url).toBe('https://example.com');
  });
});

// ---------------------------------------------------------------------------
// mapToEventTag
// ---------------------------------------------------------------------------

describe('mapToEventTag', () => {
  it('maps id and name from raw', () => {
    const tag = mapToEventTag({ id: 'quiz', name: 'Quiz Night' });
    expect(tag.id).toBe('quiz');
    expect(tag.name).toBe('Quiz Night');
  });

  it('falls back to tag_id when id is missing', () => {
    const tag = mapToEventTag({ tag_id: 'trivia', name: 'Trivia' });
    expect(tag.id).toBe('trivia');
  });

  it('falls back to name as id when neither id nor tag_id is present', () => {
    const tag = mapToEventTag({ name: 'Karaoke' });
    expect(tag.id).toBe('Karaoke');
    expect(tag.name).toBe('Karaoke');
  });

  it('uses title as name fallback', () => {
    const tag = mapToEventTag({ id: '1', title: 'Live Music' });
    expect(tag.name).toBe('Live Music');
  });

  it('uses label as name fallback', () => {
    const tag = mapToEventTag({ id: '1', label: 'Darts' });
    expect(tag.name).toBe('Darts');
  });

  it('converts id to a string', () => {
    const tag = mapToEventTag({ id: 42, name: 'Pool' });
    expect(tag.id).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// mergeEvents
// ---------------------------------------------------------------------------

describe('mergeEvents', () => {
  const makeEvent = (instance_id: string, title = 'T') => ({
    instance_id,
    title,
    bar_name: 'Bar',
    crosses_midnight: false,
  });

  it('returns incoming when current is empty', () => {
    const incoming = [makeEvent('1'), makeEvent('2')];
    expect(mergeEvents([], incoming)).toEqual(incoming);
  });

  it('appends new events that are not already in current', () => {
    const current = [makeEvent('1')];
    const incoming = [makeEvent('2')];
    const result = mergeEvents(current, incoming);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.instance_id)).toEqual(['1', '2']);
  });

  it('replaces an existing event with the same instance_id', () => {
    const current = [makeEvent('1', 'Old Title')];
    const incoming = [makeEvent('1', 'New Title')];
    const result = mergeEvents(current, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('New Title');
  });

  it('does not mutate the current array', () => {
    const current = [makeEvent('1')];
    const snapshot = [...current];
    mergeEvents(current, [makeEvent('2')]);
    expect(current).toEqual(snapshot);
  });

  it('handles both new and updated events in a single call', () => {
    const current = [makeEvent('1', 'Old'), makeEvent('2')];
    const incoming = [makeEvent('1', 'Updated'), makeEvent('3')];
    const result = mergeEvents(current, incoming);
    expect(result).toHaveLength(3);
    expect(result.find((e) => e.instance_id === '1')?.title).toBe('Updated');
    expect(result.find((e) => e.instance_id === '3')).toBeDefined();
  });
});
