import { searchVenues, Venue } from '../searchUtils';

const venues: Venue[] = [
  { name: 'The Green Dragon', type: 'pub', distance: 0.3, tags: ['live music', 'trivia'] },
  { name: 'Sunset Bar', type: 'bar', distance: 1.2, tags: ['cocktails', 'rooftop'] },
  { name: 'The Anchor', type: 'pub', distance: 0.8, tags: ['sports', 'beer garden'] },
  { name: 'Neon Lounge', type: 'lounge', distance: 2.1, tags: ['cocktails', 'live music'] },
];

// ---------------------------------------------------------------------------
// searchVenues — empty / whitespace query
// ---------------------------------------------------------------------------

describe('searchVenues — empty query', () => {
  it('returns all venues for an empty string', () => {
    expect(searchVenues(venues, '')).toEqual(venues);
  });

  it('returns all venues for a whitespace-only query', () => {
    expect(searchVenues(venues, '   ')).toEqual(venues);
  });
});

// ---------------------------------------------------------------------------
// searchVenues — name matching
// ---------------------------------------------------------------------------

describe('searchVenues — name matching', () => {
  it('matches by exact name (case-insensitive)', () => {
    const result = searchVenues(venues, 'Sunset Bar');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sunset Bar');
  });

  it('matches by partial name', () => {
    const result = searchVenues(venues, 'anchor');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('The Anchor');
  });

  it('matches multiple venues that share a name substring', () => {
    const result = searchVenues(venues, 'the');
    expect(result.map(v => v.name)).toEqual(
      expect.arrayContaining(['The Green Dragon', 'The Anchor'])
    );
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// searchVenues — type matching
// ---------------------------------------------------------------------------

describe('searchVenues — type matching', () => {
  it('returns all pubs when querying "pub"', () => {
    const result = searchVenues(venues, 'pub');
    expect(result).toHaveLength(2);
    expect(result.every(v => v.type === 'pub')).toBe(true);
  });

  it('matches type case-insensitively', () => {
    const result = searchVenues(venues, 'LOUNGE');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Neon Lounge');
  });
});

// ---------------------------------------------------------------------------
// searchVenues — tag matching
// ---------------------------------------------------------------------------

describe('searchVenues — tag matching', () => {
  it('matches venues by a tag', () => {
    const result = searchVenues(venues, 'trivia');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('The Green Dragon');
  });

  it('matches multiple venues sharing a tag', () => {
    const result = searchVenues(venues, 'cocktails');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.name)).toEqual(
      expect.arrayContaining(['Sunset Bar', 'Neon Lounge'])
    );
  });

  it('matches a partial tag substring', () => {
    const result = searchVenues(venues, 'live');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.name)).toEqual(
      expect.arrayContaining(['The Green Dragon', 'Neon Lounge'])
    );
  });

  it('matches tag case-insensitively', () => {
    const result = searchVenues(venues, 'SPORTS');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('The Anchor');
  });
});

// ---------------------------------------------------------------------------
// searchVenues — no match
// ---------------------------------------------------------------------------

describe('searchVenues — no match', () => {
  it('returns an empty array when nothing matches', () => {
    expect(searchVenues(venues, 'karaoke')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// searchVenues — edge cases
// ---------------------------------------------------------------------------

describe('searchVenues — edge cases', () => {
  it('returns an empty array when the venues list is empty', () => {
    expect(searchVenues([], 'pub')).toEqual([]);
  });

  it('handles a venue with no tags', () => {
    const noTags: Venue[] = [
      { name: 'Bare Bones Bar', type: 'bar', distance: 0.5, tags: [] },
    ];
    expect(searchVenues(noTags, 'rooftop')).toEqual([]);
    expect(searchVenues(noTags, 'bare')).toHaveLength(1);
  });
});
