// types/index.ts
// All TypeScript type definitions for the bars module

import type { Colors } from '@/constants/theme';

// Re-exporting types from individual files for easier imports
export type ThemeName = keyof typeof Colors;
export type LooseObject = Record<string, any>;
export type QueryValue = string | number | boolean | undefined;
export type QueryParams = Record<string, QueryValue>;

export type Coordinates = { 
  lat: number; 
  lon: number 
};


export type Bar = {
  id: string;
  name: string;
  description?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  posh?: string;
  eventbrite?: string;
  distance_miles?: number;
  distance_km?: number;
  tags: BarTag[];
  hours: BarHours[];
};

export type meta = {
    pagination?: pagination;
    filters?: filters;
    location?: location;
};

export type pagination = {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
    next_page: number | null;
    previous_page: number | null;
}

export type filters = {
  open_now?: boolean;
  radius?: number;
  unit?: string;
  bar_id?: string;
  upcoming?: boolean;
	event_tag_id?: string;
}

export type location = {
    lat?: number;
    lon?: number;
    sorted_by_distance?: boolean;
    unit?: string;
}

export type searchBar = {
    id: string;
    name: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
}

export type BarTag = {
  id: string;
  name: string;
  category?: string;
};

export type BarHours = {
    id: string;
    day_of_week: number;
    opens_at: string;
    closes_at: string;
    is_closed: boolean;
    crosses_midnight: boolean;
}

// Event Types
export type EventTag = {
    id: string;
    name: string;
};

export type Event = {
	instance_id: string;
    event_id?: string;
    date?: string;
    is_cancelled?: boolean;
    start_time?: string;
    end_time?: string;
    crosses_midnight?: boolean;
    description?: string;
    title: string;
    external_url?: string;
    event_tag_id?: string;
    event_tag_name?: string;
    bar_id?: string;
    bar_name?: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    phone?: string;
    website?: string;
    latitude?: number;
    longitude?: number;
	distanceMiles?: number;
	distanceKm?: number;
	eventTag?: EventTag;
};



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
