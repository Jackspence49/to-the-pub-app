// Configuration constants

import type { Coordinates, InfiniteScrollConfig, QueryParams } from '../types';

// API Configuration
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
export const NORMALIZED_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
export const BARS_ENDPOINT = NORMALIZED_BASE_URL ? `${NORMALIZED_BASE_URL}/bars` : '/get/bars';
export const TAGS_ENDPOINT = NORMALIZED_BASE_URL ? `${NORMALIZED_BASE_URL}/tags` : '/get/tags';

// Distance Conversion
export const MILES_PER_KM = 0.621371;

// Cache TTLs
export const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Default Coordinates (Boston)
export const DEFAULT_COORDS: Coordinates = {
  lat: 42.3555,
  lon: -71.0565,
};

// Base Query Parameters
export const BASE_QUERY_PARAMS: QueryParams = {
  unit: 'miles',
  open_now: true,
  include: 'tags,hours',
};

// Infinite Scroll Configuration
export const INFINITE_SCROLL_CONFIG: InfiniteScrollConfig = {
  initialPageSize: 20,
  subsequentPageSize: 20,
  loadMoreThreshold: 0.8,
  maxConcurrentRequests: 2,
  prefetchPages: 1,
  cacheTimeout: 300000, // 5 minutes
};

// Day Name to Index Mapping
export const DAY_NAME_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};