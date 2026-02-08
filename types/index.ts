// types/index.ts
// All TypeScript type definitions for the bars module

import type { Colors } from '@/constants/theme';

export type ThemeName = keyof typeof Colors;
export type LooseObject = Record<string, any>;
export type QueryValue = string | number | boolean | undefined;
export type QueryParams = Record<string, QueryValue>;
export type Coordinates = { lat: number; lon: number };

// Infinite scroll configuration
export type InfiniteScrollConfig = {
  initialPageSize: number;
  subsequentPageSize: number;
  loadMoreThreshold: number;
  maxConcurrentRequests: number;
  prefetchPages: number;
  cacheTimeout: number;
};

// Pagination state for lists
export type PaginationState = {
  data: Bar[];
  currentPage: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  totalCount?: number;
};

// Internal load modes
export type LoadMode = 'initial' | 'refresh' | 'load-more' | 'prefetch';

// Bar tag type definition
export type BarTag = {
  id: string;
  name: string;
  category?: string;
};

// Bar type definition
export type Bar = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  addressLabel?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  distanceKm?: number;
  distanceMiles?: number;
  closesToday?: string;
  crossesMidnightToday?: boolean;
  tags: BarTag[];
};

// Tag filter option type definition
export type TagFilterOption = {
  id: string;
  name: string;
  normalizedName: string;
};

// Selected tag entry for UI display
export type SelectedTagEntry = {
  normalized: string;
  label: string;
};

// Component props types
export type BarCardProps = {
  bar: Bar;
  theme: ThemeName;
  onPress?: () => void;
};

// Props for the tag filter sheet component
export type TagFilterSheetProps = {
  visible: boolean;
  tags: TagFilterOption[];
  selectedTags: string[];
  onApply: (tagIds: string[]) => void;
  onClose: () => void;
  theme: ThemeName;
};

// Props for the filter pill component
export type LocationCache = {
  coords: Coordinates;
  fetchedAt: number;
};

// Cache structure for bars data
export type BarsCache = {
  key: string;
  timestamp: number;
  data: Bar[];
  currentPage: number;
  hasMore: boolean;
  totalCount?: number;
};

// Props for the main bars list component
export type LoadBarsPageOptions = {
  ignoreCache?: boolean;
  coordsOverride?: Coordinates;
};