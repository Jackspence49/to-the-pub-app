// Configuration constants
import type { Coordinates, InfiniteScrollConfig, QueryParams } from '../types';

// API Configuration
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
export const NORMALIZED_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
export const BARS_ENDPOINT = NORMALIZED_BASE_URL ? `${NORMALIZED_BASE_URL}/bars` : '/get/bars';
export const TAGS_ENDPOINT = NORMALIZED_BASE_URL ? `${NORMALIZED_BASE_URL}/tags` : '/get/tags';
export const EVENTS_ENDPOINT = NORMALIZED_BASE_URL ? `${NORMALIZED_BASE_URL}/events` : '/get/events';

// Cache TTLs
export const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Default Coordinates (Boston)
export const DEFAULT_COORDS: Coordinates = {
  lat: 42.3555,
  lon: -71.0565,
};

// Base index.tsx Parameters (align with backend expectations)
export const INDEX_BASE_QUERY_PARAMS: QueryParams = {
  unit: 'miles',
  include: 'tags',
  open_now: 'true',
};

//Event.tsx Parameters
export const EVENTS_BASE_QUERY_PARAMS: QueryParams = {
  radius: 10,
  unit: 'miles',
  upcoming: 'true',
}

export const RADIUS_OPTIONS = [1, 3, 5, 10];

// Infinite Scroll Configuration
export const INFINITE_SCROLL_CONFIG: InfiniteScrollConfig = {
  initialPageSize: 10,
  subsequentPageSize: 10,
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

// barDetails.tsx Hero map delta configuration for consistent zoom level
export const HERO_MAP_DELTA = {
	latitudeDelta: 0.005,
	longitudeDelta: 0.005,
};