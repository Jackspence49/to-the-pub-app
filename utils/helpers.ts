// General utility functions
import { Linking } from 'react-native';
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

const SOCIAL_BASE_URLS: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  twitter: 'https://x.com/',
};

export const toSocialUrl = (value: string, platform: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const username = value.startsWith('@') ? value.slice(1) : value;
  const base = SOCIAL_BASE_URLS[platform];
  return base ? `${base}${username}` : `https://${username}`;
};

//Open an external link with error handling
export const openExternalLink = async (url?: string): Promise<void> => {
  if (!url) {
    return;
  }
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (err) {
    console.warn('Failed to open link:', url, err);
  }
};

//Build a cache key based on coordinates, selected tags, and optional radius
export const getCacheKey = (coords: Coordinates, normalizedTags: string[], radius?: number): string => {
  const tagsKey = normalizedTags.slice().sort().join(',');
  const radiusKey = radius !== undefined ? `|r${radius}` : '';
  return `${coords.lat}|${coords.lon}|${tagsKey}${radiusKey}`;
};

export const formatCityAddress = (address_city?: string, address_state?: string): string | null => {
  const parts = [address_city, address_state].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts.join(', ');
};

export const formatEventDay = (value?: string): string => {
  if (!value) return 'Date coming soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date coming soon';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatEventTime = (value?: string): string | null => {
  if (!value) return null;
  const normalized = /^\d{2}:\d{2}(:\d{2})?$/.test(value)
    ? `1970-01-01T${value}`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const openExternal = async (url?: string): Promise<void> => {
  if (!url) return;
  try {
    await Linking.openURL(ensureProtocol(url));
  } catch (err) {
    console.warn('Unable to open URL', err);
  }
};

export const openPhone = async (phone?: string): Promise<void> => {
  if (!phone) return;
  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits) return;
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch (err) {
    console.warn('Unable to open dialer', err);
  }
};