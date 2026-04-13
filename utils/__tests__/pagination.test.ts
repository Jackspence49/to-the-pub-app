import { shouldContinuePagination, extractTotalCount, PayloadWithPagination } from '../pagination';
import type { pagination } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePagination = (overrides: Partial<pagination> = {}): pagination => ({
  current_page: 1,
  per_page: 20,
  total: 100,
  total_pages: 5,
  has_next_page: true,
  has_previous_page: false,
  next_page: 2,
  previous_page: null,
  ...overrides,
});

const makePayload = (paginationOverrides?: Partial<pagination>): PayloadWithPagination => ({
  meta: { pagination: makePagination(paginationOverrides) },
});

// ---------------------------------------------------------------------------
// shouldContinuePagination
// ---------------------------------------------------------------------------

describe('shouldContinuePagination', () => {
  describe('when has_next_page is present', () => {
    it('returns true when has_next_page is true', () => {
      const payload = makePayload({ has_next_page: true });
      expect(shouldContinuePagination(payload, 20, 20)).toBe(true);
    });

    it('returns false when has_next_page is false, even if count suggests more', () => {
      const payload = makePayload({ has_next_page: false });
      expect(shouldContinuePagination(payload, 20, 20)).toBe(false);
    });

    it('returns false when has_next_page is false and receivedCount < pageSize', () => {
      const payload = makePayload({ has_next_page: false });
      expect(shouldContinuePagination(payload, 5, 20)).toBe(false);
    });
  });

  describe('when has_next_page is absent but total_pages is present', () => {
    const makePayloadWithoutHasNextPage = (overrides: Partial<pagination> = {}): PayloadWithPagination => {
      const { has_next_page, ...rest } = makePagination(overrides);
      return { meta: { pagination: rest as pagination } };
    };

    it('returns true when current_page < total_pages', () => {
      const payload = makePayloadWithoutHasNextPage({ current_page: 2, total_pages: 5 });
      expect(shouldContinuePagination(payload, 20, 20)).toBe(true);
    });

    it('returns false when current_page === total_pages and count does not suggest more', () => {
      const payload = makePayloadWithoutHasNextPage({ current_page: 5, total_pages: 5 });
      expect(shouldContinuePagination(payload, 5, 20)).toBe(false);
    });

    it('returns true when current_page === total_pages but receivedCount >= pageSize', () => {
      const payload = makePayloadWithoutHasNextPage({ current_page: 5, total_pages: 5 });
      expect(shouldContinuePagination(payload, 20, 20)).toBe(true);
    });
  });

  describe('when no usable pagination meta is present', () => {
    const emptyMeta = { meta: { pagination: {} as pagination } };

    it('returns true when receivedCount >= expectedPageSize', () => {
      expect(shouldContinuePagination(emptyMeta, 20, 20)).toBe(true);
    });

    it('returns false when receivedCount < expectedPageSize', () => {
      expect(shouldContinuePagination(emptyMeta, 5, 20)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// extractTotalCount
// ---------------------------------------------------------------------------

describe('extractTotalCount', () => {
  it('returns the total from meta.pagination.total', () => {
    const payload = makePayload({ total: 42 });
    expect(extractTotalCount(payload)).toBe(42);
  });

  it('returns 0 when total is 0', () => {
    const payload = makePayload({ total: 0 });
    expect(extractTotalCount(payload)).toBe(0);
  });

  it('returns undefined when pagination is missing', () => {
    const payload = { meta: {} } as unknown as PayloadWithPagination;
    expect(extractTotalCount(payload)).toBeUndefined();
  });

  it('returns undefined when total is not a number', () => {
    const payload = { meta: { pagination: { total: 'many' } } } as unknown as PayloadWithPagination;
    expect(extractTotalCount(payload)).toBeUndefined();
  });

  it('returns undefined when payload is null', () => {
    expect(extractTotalCount(null as unknown as PayloadWithPagination)).toBeUndefined();
  });
});
