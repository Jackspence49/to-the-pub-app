import {
  mapToBarTag,
  mapToBarHour,
  mapToBar,
  mapBarsInBatches,
  mergeBars,
} from '../Barmappers';

// ---------------------------------------------------------------------------
// mapToBarTag
// ---------------------------------------------------------------------------

describe('mapToBarTag', () => {
  it('returns null for null/undefined', () => {
    expect(mapToBarTag(null, 0)).toBeNull();
    expect(mapToBarTag(undefined, 0)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(mapToBarTag('   ', 0)).toBeNull();
  });

  it('maps a plain string to id and name', () => {
    const tag = mapToBarTag('trivia', 0);
    expect(tag).toEqual({ id: 'trivia', name: 'trivia' });
  });

  it('trims whitespace from string tags', () => {
    const tag = mapToBarTag('  quiz  ', 0);
    expect(tag).toEqual({ id: 'quiz', name: 'quiz' });
  });

  it('returns null for an object with no name-like field', () => {
    expect(mapToBarTag({ foo: 'bar' }, 0)).toBeNull();
  });

  it('maps an object with id and name', () => {
    const tag = mapToBarTag({ id: 'live-music', name: 'Live Music' }, 0);
    expect(tag?.id).toBe('live-music');
    expect(tag?.name).toBe('Live Music');
  });

  it('falls back to title as name', () => {
    const tag = mapToBarTag({ id: '1', title: 'Karaoke' }, 0);
    expect(tag?.name).toBe('Karaoke');
  });

  it('falls back to label as name', () => {
    const tag = mapToBarTag({ id: '1', label: 'Darts' }, 0);
    expect(tag?.name).toBe('Darts');
  });

  it('falls back to slug as name', () => {
    const tag = mapToBarTag({ id: '1', slug: 'pool' }, 0);
    expect(tag?.name).toBe('pool');
  });

  it('falls back to tag_id when id is missing', () => {
    const tag = mapToBarTag({ tag_id: 'bingo', name: 'Bingo' }, 0);
    expect(tag?.id).toBe('bingo');
  });

  it('falls back to slug as id when neither id nor tag_id is present', () => {
    const tag = mapToBarTag({ slug: 'comedy', name: 'Comedy' }, 0);
    expect(tag?.id).toBe('comedy');
  });

  it('generates a fallback id from name and index when no id-like field exists', () => {
    const tag = mapToBarTag({ name: 'Open Mic' }, 3);
    expect(tag?.id).toBe('Open Mic-3');
    expect(tag?.name).toBe('Open Mic');
  });

  it('includes category when present', () => {
    const tag = mapToBarTag({ id: '1', name: 'Quiz', category: 'games' }, 0);
    expect(tag?.category).toBe('games');
  });

  it('falls back to type as category', () => {
    const tag = mapToBarTag({ id: '1', name: 'Quiz', type: 'entertainment' }, 0);
    expect(tag?.category).toBe('entertainment');
  });

  it('converts id to a string', () => {
    const tag = mapToBarTag({ id: 42, name: 'Pool' }, 0);
    expect(tag?.id).toBe('42');
  });

  it('returns null for non-string, non-object primitives', () => {
    expect(mapToBarTag(123, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapToBarHour
// ---------------------------------------------------------------------------

describe('mapToBarHour', () => {
  it('returns null when day_of_week is missing', () => {
    expect(mapToBarHour({ open_time: '09:00', close_time: '22:00' })).toBeNull();
  });

  it('returns null when day_of_week is out of range', () => {
    expect(mapToBarHour({ day_of_week: 7 })).toBeNull();
    expect(mapToBarHour({ day_of_week: -1 })).toBeNull();
  });

  it('maps numeric day_of_week', () => {
    const hour = mapToBarHour({ day_of_week: 1, open_time: '10:00', close_time: '23:00' });
    expect(hour?.day_of_week).toBe(1);
  });

  it('maps string numeric day_of_week', () => {
    const hour = mapToBarHour({ day_of_week: '5', open_time: '11:00', close_time: '00:00' });
    expect(hour?.day_of_week).toBe(5);
  });

  it('maps day name string to numeric index', () => {
    const hour = mapToBarHour({ day_of_week: 'Friday', open_time: '12:00', close_time: '02:00' });
    expect(hour?.day_of_week).toBe(5);
  });

  it('maps dayOfWeek camelCase alias', () => {
    const hour = mapToBarHour({ dayOfWeek: 3, open_time: '09:00', close_time: '21:00' });
    expect(hour?.day_of_week).toBe(3);
  });

  it('maps open_time and close_time', () => {
    const hour = mapToBarHour({ day_of_week: 0, open_time: '08:00', close_time: '20:00' });
    expect(hour?.open_time).toBe('08:00');
    expect(hour?.close_time).toBe('20:00');
  });

  it('falls back to openTime / closeTime camelCase aliases', () => {
    const hour = mapToBarHour({ day_of_week: 2, openTime: '09:00', closeTime: '21:00' });
    expect(hour?.open_time).toBe('09:00');
    expect(hour?.close_time).toBe('21:00');
  });

  it('defaults open_time and close_time to empty string when absent', () => {
    const hour = mapToBarHour({ day_of_week: 4 });
    expect(hour?.open_time).toBe('');
    expect(hour?.close_time).toBe('');
  });

  it('sets is_closed to true when present', () => {
    const hour = mapToBarHour({ day_of_week: 6, is_closed: true });
    expect(hour?.is_closed).toBe(true);
  });

  it('defaults is_closed to false', () => {
    const hour = mapToBarHour({ day_of_week: 0 });
    expect(hour?.is_closed).toBe(false);
  });

  it('sets crosses_midnight to true when present', () => {
    const hour = mapToBarHour({ day_of_week: 5, crosses_midnight: true });
    expect(hour?.crosses_midnight).toBe(true);
  });

  it('defaults crosses_midnight to false', () => {
    const hour = mapToBarHour({ day_of_week: 0 });
    expect(hour?.crosses_midnight).toBe(false);
  });

  it('converts id to string', () => {
    const hour = mapToBarHour({ id: 99, day_of_week: 1 });
    expect(hour?.id).toBe('99');
  });
});

// ---------------------------------------------------------------------------
// mapToBar
// ---------------------------------------------------------------------------

describe('mapToBar', () => {
  it('returns null when id is missing', () => {
    expect(mapToBar({ name: 'The Pub' }, 0)).toBeNull();
  });

  it('returns null when name is missing', () => {
    expect(mapToBar({ id: '1' }, 0)).toBeNull();
  });

  it('maps a minimal bar', () => {
    const bar = mapToBar({ id: '1', name: 'The Pub' }, 0);
    expect(bar?.id).toBe('1');
    expect(bar?.name).toBe('The Pub');
  });

  it('converts id to a string', () => {
    const bar = mapToBar({ id: 42, name: 'Bar' }, 0);
    expect(bar?.id).toBe('42');
  });

  it('maps optional scalar fields', () => {
    const raw = {
      id: '1',
      name: 'Bar',
      description: 'A nice bar',
      address_street: '123 Main St',
      address_city: 'Boston',
      address_state: 'MA',
      address_zip: '02101',
      phone: '555-1234',
      website: 'https://thebar.com',
      instagram: 'thebar',
      facebook: 'thebar',
    };
    const bar = mapToBar(raw, 0);
    expect(bar?.description).toBe('A nice bar');
    expect(bar?.address_street).toBe('123 Main St');
    expect(bar?.address_city).toBe('Boston');
    expect(bar?.address_state).toBe('MA');
    expect(bar?.address_zip).toBe('02101');
    expect(bar?.phone).toBe('555-1234');
    expect(bar?.website).toBe('https://thebar.com');
    expect(bar?.instagram).toBe('thebar');
    expect(bar?.facebook).toBe('thebar');
  });

  it('maps latitude and longitude as numbers', () => {
    const bar = mapToBar({ id: '1', name: 'Bar', latitude: '42.3555', longitude: '-71.0565' }, 0);
    expect(bar?.latitude).toBe(42.3555);
    expect(bar?.longitude).toBe(-71.0565);
  });

  it('maps distance_miles and distance_km', () => {
    const bar = mapToBar({ id: '1', name: 'Bar', distance_miles: 1.5, distance_km: 2.4 }, 0);
    expect(bar?.distance_miles).toBe(1.5);
    expect(bar?.distance_km).toBe(2.4);
  });

  it('uses closes_at directly when present', () => {
    const bar = mapToBar({ id: '1', name: 'Bar', closes_at: '23:00' }, 0);
    expect(bar?.closes_at).toBe('23:00');
  });

  it('falls back to raw.close_time for closes_at', () => {
    const bar = mapToBar({ id: '1', name: 'Bar', close_time: '22:00' }, 0);
    expect(bar?.closes_at).toBe('22:00');
  });

  it('resolves closes_at from hours schedule for today', () => {
    const today = new Date().getDay();
    const raw = {
      id: '1',
      name: 'Bar',
      hours: [{ day_of_week: today, close_time: '02:00' }],
    };
    const bar = mapToBar(raw, 0);
    expect(bar?.closes_at).toBe('02:00');
  });

  it('maps tags and deduplicates them by id', () => {
    const raw = {
      id: '1',
      name: 'Bar',
      tags: [
        { id: 'quiz', name: 'Quiz' },
        { id: 'quiz', name: 'Quiz' },
        { id: 'darts', name: 'Darts' },
      ],
    };
    const bar = mapToBar(raw, 0);
    expect(bar?.tags).toHaveLength(2);
    expect(bar?.tags.map((t) => t.id)).toEqual(['quiz', 'darts']);
  });

  it('maps hours array', () => {
    const raw = {
      id: '1',
      name: 'Bar',
      hours: [
        { day_of_week: 1, open_time: '11:00', close_time: '23:00' },
        { day_of_week: 2, open_time: '11:00', close_time: '23:00' },
      ],
    };
    const bar = mapToBar(raw, 0);
    expect(bar?.hours).toHaveLength(2);
    expect(bar?.hours[0].day_of_week).toBe(1);
  });

  it('filters out invalid hours entries', () => {
    const raw = {
      id: '1',
      name: 'Bar',
      hours: [
        { open_time: '11:00', close_time: '23:00' }, // missing day_of_week
        { day_of_week: 3, open_time: '12:00', close_time: '22:00' },
      ],
    };
    const bar = mapToBar(raw, 0);
    expect(bar?.hours).toHaveLength(1);
  });

  it('defaults tags to [] when absent', () => {
    const bar = mapToBar({ id: '1', name: 'Bar' }, 0);
    expect(bar?.tags).toEqual([]);
  });

  it('defaults hours to [] when absent', () => {
    const bar = mapToBar({ id: '1', name: 'Bar' }, 0);
    expect(bar?.hours).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapBarsInBatches
// ---------------------------------------------------------------------------

describe('mapBarsInBatches', () => {
  it('returns an empty array for empty input', async () => {
    const result = await mapBarsInBatches([]);
    expect(result).toEqual([]);
  });

  it('maps all valid bars', async () => {
    const items = [
      { id: '1', name: 'Bar One' },
      { id: '2', name: 'Bar Two' },
    ];
    const result = await mapBarsInBatches(items);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('filters out items missing id or name', async () => {
    const items = [
      { id: '1', name: 'Valid' },
      { name: 'No ID' },
      { id: '3' },
    ];
    const result = await mapBarsInBatches(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('processes more items than a single batch', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 1), name: `Bar ${i + 1}` }));
    const result = await mapBarsInBatches(items, 0, 20);
    expect(result).toHaveLength(50);
  });

  it('respects a custom startIndex for tag fallback ids', async () => {
    // Just verify it resolves without error when startIndex is provided
    const items = [{ id: '1', name: 'Bar' }];
    const result = await mapBarsInBatches(items, 10);
    expect(result[0].id).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// mergeBars
// ---------------------------------------------------------------------------

describe('mergeBars', () => {
  const makeBar = (id: string, name = 'Bar') => ({
    id,
    name,
    tags: [],
    hours: [],
  });

  it('returns incoming when current is empty', () => {
    const incoming = [makeBar('1'), makeBar('2')];
    expect(mergeBars([], incoming)).toEqual(incoming);
  });

  it('returns incoming when replace is true', () => {
    const current = [makeBar('1')];
    const incoming = [makeBar('2')];
    expect(mergeBars(current, incoming, true)).toEqual(incoming);
  });

  it('appends new bars not already in current', () => {
    const current = [makeBar('1')];
    const incoming = [makeBar('2')];
    const result = mergeBars(current, incoming);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('replaces an existing bar with the same id', () => {
    const current = [makeBar('1', 'Old Name')];
    const incoming = [makeBar('1', 'New Name')];
    const result = mergeBars(current, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New Name');
  });

  it('does not mutate the current array', () => {
    const current = [makeBar('1')];
    const snapshot = [...current];
    mergeBars(current, [makeBar('2')]);
    expect(current).toEqual(snapshot);
  });

  it('handles both new and updated bars in a single call', () => {
    const current = [makeBar('1', 'Old'), makeBar('2')];
    const incoming = [makeBar('1', 'Updated'), makeBar('3')];
    const result = mergeBars(current, incoming);
    expect(result).toHaveLength(3);
    expect(result.find((b) => b.id === '1')?.name).toBe('Updated');
    expect(result.find((b) => b.id === '3')).toBeDefined();
  });
});
