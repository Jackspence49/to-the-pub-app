// Pagination-related utility functions

import type { LooseObject } from '../types';

//Extract pagination metadata from common response shapes
export const extractPaginationMeta = (payload: unknown): LooseObject | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as LooseObject;
  const buckets = [
    record.meta?.pagination,
    record.meta,
    record.pagination,
    record.data?.pagination,
  ];

  for (const bucket of buckets) {
    if (bucket && typeof bucket === 'object') {
      return bucket as LooseObject;
    }
  }

  return null;
};

// Determine if another page likely exists
 
export const shouldContinuePagination = (
  payload: unknown,
  receivedCount: number,
  expectedPageSize: number
): boolean => {
  const countSuggestsMore = receivedCount >= expectedPageSize;
  const pagination = extractPaginationMeta(payload);

  if (pagination) {
    const booleanFlags = [
      pagination.has_next_page,
      pagination.has_next,
      pagination.has_more,
      pagination.has_more_pages,
      pagination.hasNextPage,
      pagination.hasMore,
      pagination.hasMorePages,
    ];

    for (const flag of booleanFlags) {
      if (typeof flag === 'boolean') {
        // Be optimistic if the API says no but we still received a full page
        return flag || countSuggestsMore;
      }
    }

    const current =
      pagination.current_page ??
      pagination.page ??
      pagination.page_number ??
      pagination.pageNumber;
    const total = pagination.total_pages ?? pagination.totalPages;

    if (typeof current === 'number' && typeof total === 'number') {
      return current < total || countSuggestsMore;
    }

    if (typeof pagination.next_page !== 'undefined') {
      return Boolean(pagination.next_page) || countSuggestsMore;
    }
  }

  return countSuggestsMore;
};

//Extract total count if provided
export const extractTotalCount = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as LooseObject;
  const candidates = [
    record.total,
    record.total_count,
    record.count,
    record.meta?.total,
    record.meta?.total_count,
    record.meta?.pagination?.total,
    record.pagination?.total,
    record.data?.total,
    record.data?.total_count,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number') {
      return candidate;
    }
  }

  return undefined;
};