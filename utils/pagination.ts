// Pagination-related utility functions
import type { pagination } from '../types';

// Expected response shape: pagination always under meta.pagination
export type PayloadWithPagination = {
  meta: { pagination: pagination;};
};

// Safely extract pagination metadata, returning null if not present or malformed
const pickPagination = (payload: PayloadWithPagination | null | undefined): pagination | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload.meta?.pagination ?? null;
};

// Determine if another page likely exists
export const shouldContinuePagination = (
  payload: PayloadWithPagination,
  receivedCount: number,
  expectedPageSize: number
): boolean => {
  const countSuggestsMore = receivedCount >= expectedPageSize;
  const pageMeta = pickPagination(payload);

  if (!pageMeta) {
    return countSuggestsMore;
  }

  if (typeof pageMeta.has_next_page === 'boolean') {
    return pageMeta.has_next_page || countSuggestsMore;
  }

  if (typeof pageMeta.total_pages === 'number') {
    return pageMeta.current_page < pageMeta.total_pages || countSuggestsMore;
  }

  return countSuggestsMore;
};

// Extract total count if provided
export const extractTotalCount = (payload: PayloadWithPagination): number | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidates = [
    payload.meta?.pagination?.total,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number') {
      return candidate;
    }
  }

  return undefined;
};
