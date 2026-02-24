// General utility functions
import type { Coordinates, LooseObject, QueryParams } from '../types';

 // Build a URL query string from parameters
export const buildQueryString = (params: QueryParams): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');


// Extract bar items from various API response structures
export const extractBarItems = (payload: unknown): LooseObject[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload as LooseObject[];
  }

  if (typeof payload !== 'object') {
    return [];
  }

  const record = payload as LooseObject;
  const candidates = [
    record.data?.data,
    record.data
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as LooseObject[];
    }
  }

  return [];
};

// Safely convert a value to a number
export const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

// Format distance labels for display
export const formatDistanceLabel = (distanceMiles?: number): string | null => {
  if (typeof distanceMiles !== 'number' || Number.isNaN(distanceMiles) || distanceMiles < 0) {
    return null;
  }

  if (distanceMiles === 0) {
    return 'Right here';
  }

    if (distanceMiles < 0.1) {
    return `${(distanceMiles * 5280).toFixed(0)} ft away`;
  }

  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(2)} mi away`;
  }

    if (distanceMiles < 100) {
    return `${distanceMiles.toFixed(1)} mi away`;
  }

  return `${distanceMiles.toFixed(0)} mi away`;
};

// Ensure a URL has a protocol
export const ensureProtocol = (url: string): string => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
};

// Normalize Twitter or X.com URLs or handles
export const normalizeTwitterUrl = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.)?(?:twitter\.com|x\.com)(?:\/|$)/i.test(trimmed)) {
    return ensureProtocol(trimmed);
  }

  const handle = trimmed.replace(/^@/, '');
  if (!handle) {
    return undefined;
  }

  return `https://x.com/${handle}`;
};

//Open an external link with error handling
export const openExternalLink = async (url?: string): Promise<void> => {
  if (!url) {
    return;
  }
  const { Linking } = await import('react-native');
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (err) {
    console.warn('Failed to open link:', url, err);
  }
};

//Build a cache key based on coordinates and selected tags
export const getCacheKey = (coords: Coordinates, normalizedTags: string[]): string => {
  const tagsKey = normalizedTags.slice().sort().join(',');
  return `${coords.lat}|${coords.lon}|${tagsKey}`;
};