import { FontAwesome, MaterialIcons } from '@expo/vector-icons'; // Icon libraries
import * as Location from 'expo-location'; // Location services
import { useFocusEffect, useRouter } from 'expo-router'; // Navigation hooks 
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';

// React Native components
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
 
// Custom constants and hooks
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// API and utility constants
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();  // Base URL for API requests
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');  
const barsEndpoint = normalizedBaseUrl ? `${normalizedBaseUrl}/bars` : '/get/bars';
const MILES_PER_KM = 0.621371;

// Type definitions
type ThemeName = keyof typeof Colors;  // Theme name type
type LooseObject = Record<string, any>;  // Generic object type
type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue>;
type Coordinates = { lat: number; lon: number };

// Infinite scroll configuration
type InfiniteScrollConfig = {
  initialPageSize: number;
  subsequentPageSize: number;
  loadMoreThreshold: number;
  maxConcurrentRequests: number;
  prefetchPages: number;
  cacheTimeout: number;
};

// Pagination state for lists
type PaginationState = {
  data: Bar[];
  currentPage: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  totalCount?: number;
};

// Internal load modes
type LoadMode = 'initial' | 'refresh' | 'load-more' | 'prefetch';

// Bar tag type definition
type BarTag = {
  id: string;
  name: string;
  category?: string;
};

// Bar type definition
type Bar = {
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
type TagFilterOption = {
  id: string;
  name: string;
  normalizedName: string;
  count: number;
};

//Default parameters
const DEFAULT_COORDS: Coordinates = {
  lat: 42.3555,
  lon: -71.0565,
};

const BASE_QUERY_PARAMS: QueryParams = {
  unit: 'miles',
  open_now: true,
  include: 'tags,hours',
};

const INFINITE_SCROLL_CONFIG: InfiniteScrollConfig = {
  initialPageSize: 20,
  subsequentPageSize: 20,
  loadMoreThreshold: 0.8,
  maxConcurrentRequests: 2,
  prefetchPages: 1,
  cacheTimeout: 300000,
};

// Helper function to build query string from parameters
const buildQueryString = (params: QueryParams): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  // Function to extract bar items from API response payload
const extractBarItems = (payload: unknown): LooseObject[] => {
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
    record.data?.bars,
    record.data?.items,
    record.data?.data,
    record.data?.results,
    record.data,
    record.bars,
    record.items,
    record.results,
    record.payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as LooseObject[];
    }
  }

  return [];
};

// Helper function to safely convert a value to a number
const toNumber = (value: unknown): number | undefined => {
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

// Function to map raw tag data to BarTag type
const mapToBarTag = (raw: any, index: number): BarTag | null => {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return { id: trimmed, name: trimmed };
  }

  if (typeof raw === 'object') {
    const source = raw as LooseObject;
    const name = source.name ?? source.title ?? source.label ?? source.slug;
    if (!name) {
      return null;
    }

    const id = source.id ?? source.tag_id ?? source.slug ?? `${name}-${index}`;
    return {
      id: String(id),
      name: String(name),
      category: source.category ?? source.type ?? undefined,
    };
  }

  return null;
};

// Mapping of day names to their respective indices
const DAY_NAME_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Function to coerce various day representations to a numeric index
const coerceDayIndex = (value: unknown): number | null => {
  if (typeof value === 'number' && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!Number.isNaN(Number(trimmed))) {
      const numeric = Number(trimmed);
      if (numeric >= 0 && numeric <= 6) {
        return numeric;
      }
    }
    const lookup = DAY_NAME_INDEX[trimmed.toLowerCase() as keyof typeof DAY_NAME_INDEX];
    return typeof lookup === 'number' ? lookup : null;
  }
  return null;
};

// Function to extract closing time metadata from a schedule record
const extractCloseMetaFromRecord = (record?: LooseObject | null): { closesAt?: string; crossesMidnight?: boolean } | null => {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const closesRaw = record.close_time;
  const closesAt = typeof closesRaw === 'string' && closesRaw.trim().length > 0 ? closesRaw.trim() : undefined;
  const crossesMidnight = Boolean(record.crosses_midnight ?? false);
  if (!closesAt && !crossesMidnight) {
    return null;
  }
  return { closesAt, crossesMidnight };
};

// Function to resolve closing time from various schedule buckets
const resolveClosingFromSchedules = (raw: LooseObject): { closesAt?: string; crossesMidnight?: boolean } | null => {
  const scheduleBuckets = [raw.hours];
  const today = new Date().getDay();
  for (const bucket of scheduleBuckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }
    for (const entry of bucket) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as LooseObject;
      const entryDay = coerceDayIndex(
        record.day_of_week ?? record.dayOfWeek ?? record.day ?? record.dayName ?? record.weekday ?? record.weekDay ?? record.name
      );
      if (entryDay !== today) {
        continue;
      }
      const meta = extractCloseMetaFromRecord(record);
      if (meta) {
        return meta;
      }
    }
  }
  return null;
};

// Function to extract today's closing time metadata from raw bar data
const extractTodayClosingMeta = (raw: LooseObject): { closesAt?: string; crossesMidnight?: boolean } => {
  let closesAt: string | undefined;
  let crossesMidnight: boolean | undefined;

  const assignCandidate = (value?: unknown) => {
    if (!closesAt && typeof value === 'string' && value.trim().length > 0) {
      closesAt = value.trim();
    }
  };

  // Check direct fields for closing time
  const directCandidates: unknown[] = [raw.close_time];
  directCandidates.forEach(assignCandidate);

  const hoursTodayVariants = [
    raw.hours_today,
    raw.hoursToday,
    raw.today_hours,
    raw.todayHours,
    raw.current_hours,
    raw.currentHours,
  ];
  for (const variant of hoursTodayVariants) {
    const meta = extractCloseMetaFromRecord(variant as LooseObject | null);
    if (meta) {
      if (!closesAt && meta.closesAt) {
        closesAt = meta.closesAt;
      }
      if (typeof meta.crossesMidnight === 'boolean') {
        crossesMidnight = meta.crossesMidnight;
      }
      if (closesAt) {
        break;
      }
    }
  }

  if (!closesAt || crossesMidnight === undefined) {
    const scheduleMeta = resolveClosingFromSchedules(raw);
    if (scheduleMeta) {
      if (!closesAt && scheduleMeta.closesAt) {
        closesAt = scheduleMeta.closesAt;
      }
      if (typeof scheduleMeta.crossesMidnight === 'boolean') {
        crossesMidnight = scheduleMeta.crossesMidnight;
      }
    }
  }

  return {
    closesAt,
    crossesMidnight,
  };
};

// Function to map raw bar data to Bar type
const mapToBar = (raw: LooseObject, index: number): Bar => {
  const idSource =
    raw.id ??
    raw.bar_id ??
    raw.uuid ??
    raw.slug ??
    raw.external_id ??
    `bar-${index}`;

  const location = (raw.address ?? raw.location ?? {}) as LooseObject;
  const city = raw.address_city ?? raw.city ?? location.city;
  const state = raw.address_state ?? raw.state ?? location.state;
  const cityState = [city, state].filter(Boolean).join(', ');
  const addressLabel = cityState || city || state || undefined;
  const distanceKm = toNumber(raw.distance_km ?? raw.distanceKm ?? raw.distance);
  const distanceMilesExplicit = toNumber(
    raw.distance_miles ?? raw.distanceMiles ?? raw.distance_mi ?? raw.distanceMi ?? raw.distanceMilesAway
  );
  const distanceMiles =
    typeof distanceMilesExplicit === 'number'
      ? distanceMilesExplicit
      : typeof distanceKm === 'number'
        ? distanceKm * MILES_PER_KM
        : undefined;

  const rawTags = Array.isArray(raw.tags)
    ? raw.tags
    : Array.isArray(raw.tag_list)
      ? raw.tag_list
      : [];

  const dedupedTags: BarTag[] = [];
  rawTags
    .map((tag, tagIndex) => mapToBarTag(tag, tagIndex))
    .filter((tag): tag is BarTag => Boolean(tag))
    .forEach((tag) => {
      if (!dedupedTags.some((existing) => existing.id === tag.id)) {
        dedupedTags.push(tag);
      }
    });

  const closingMeta = extractTodayClosingMeta(raw);
  const closesToday = closingMeta.closesAt;
  const crossesMidnightToday = Boolean(
    raw.crosses_midnight_today ??
      raw.crossesMidnightToday ??
      closingMeta.crossesMidnight ??
      false
  );

  return {
    id: String(idSource),
    name: raw.name ?? raw.title ?? 'Unnamed bar',
    city: city ? String(city) : undefined,
    state: state ? String(state) : undefined,
    addressLabel,
    instagram: raw.instagram ?? undefined,
    facebook: raw.facebook ?? undefined,
    twitter: normalizeTwitterUrl(raw.twitter),
    distanceKm,
    distanceMiles,
    closesToday,
    crossesMidnightToday,
    tags: dedupedTags,
  };
};

// Function to normalize Twitter or X.com URLs or handles
const normalizeTwitterUrl = (value: unknown): string | undefined => {
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

// Function to normalize tag names for filtering
const normalizeTagName = (value: string): string => value.trim().toLowerCase();

// Function to format distance labels for display
const formatDistanceLabel = (distanceMiles?: number): string | null => {
  if (typeof distanceMiles !== 'number' || Number.isNaN(distanceMiles) || distanceMiles < 0) {
    return null;
  }

  if (distanceMiles === 0) {
    return 'Right here';
  }

  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(2)} mi away`;
  }

  return `${distanceMiles.toFixed(1)} mi away`;
};

// Extract pagination metadata from common response shapes
const extractPaginationMeta = (payload: unknown): LooseObject | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as LooseObject;
  const buckets = [record.meta?.pagination, record.meta, record.pagination, record.data?.pagination];

  for (const bucket of buckets) {
    if (bucket && typeof bucket === 'object') {
      return bucket as LooseObject;
    }
  }

  return null;
};

// Determine if another page likely exists
const shouldContinuePagination = (
  payload: unknown,
  receivedCount: number,
  expectedPageSize: number
): boolean => {
  const pagination = extractPaginationMeta(payload);
  if (pagination) {
    if (typeof pagination.has_next_page === 'boolean') {
      return pagination.has_next_page;
    }
    if (typeof pagination.next_page !== 'undefined') {
      return Boolean(pagination.next_page);
    }
    const current =
      pagination.current_page ??
      pagination.page ??
      pagination.page_number ??
      pagination.pageNumber;
    const total = pagination.total_pages ?? pagination.totalPages;

    if (typeof current === 'number' && typeof total === 'number') {
      return current < total;
    }
  }

  return receivedCount === expectedPageSize;
};

// Extract total count if provided
const extractTotalCount = (payload: unknown): number | undefined => {
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

// Merge bar lists while preserving order and deduping by id
const mergeBars = (current: Bar[], incoming: Bar[], replace = false): Bar[] => {
  if (replace || current.length === 0) {
    return incoming;
  }

  const next = [...current];
  incoming.forEach((bar) => {
    const index = next.findIndex((item) => item.id === bar.id);
    if (index === -1) {
      next.push(bar);
    } else {
      next[index] = bar;
    }
  });

  return next;
};

// Build a cache key based on coordinates and selected tags
const getCacheKey = (coords: Coordinates, normalizedTags: string[]): string => {
  const tagsKey = normalizedTags.slice().sort().join(',');
  return `${coords.lat}|${coords.lon}|${tagsKey}`;
};

// Function to parse various time formats into Date objects
const parseTimeToken = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp);
  }

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2] ?? '0');
    const meridian = amPmMatch[4]?.toLowerCase();
    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    if (hours > 23 || minutes > 59) {
      return null;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const fourDigitMatch = trimmed.match(/^(\d{2})(\d{2})$/);
  if (fourDigitMatch) {
    const hours = Number(fourDigitMatch[1]);
    const minutes = Number(fourDigitMatch[2]);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && hours <= 23 && minutes <= 59) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
  }

  return null;
};

// Function to format closing time labels for display
const formatClosingTimeLabel = (value?: string): string | null => {
  const parsed = parseTimeToken(value);
  if (!parsed) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

// Function to ensure a URL has a protocol prefix
const ensureProtocol = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
};

// Function to open external links safely
const openExternalLink = async (value?: string) => {
  if (!value) {
    return;
  }

  try {
    await Linking.openURL(ensureProtocol(value));
  } catch (error) {
    console.warn('Unable to open URL', error);
  }
};

// Props for BarCard component
type BarCardProps = {
  bar: Bar;
  theme: ThemeName;
  onPress?: () => void;
};

// Component to display individual bar information
const BarCard = ({ bar, theme, onPress }: BarCardProps) => {
  const palette = Colors[theme];
  const cardTitle = palette.cardTitle;
  const cardSubtitle = palette.cardSubtitle;
  const cardText = palette.cardText;
  const cardSurface = palette.cardSurface;
  const cardBorder = palette.border;
  const pillBackground = palette.pillBackground;
  const pillBorder = palette.border;
  const pillText = palette.pillText;
  const iconSelected = palette.iconSelected;
  const distanceLabel = formatDistanceLabel(bar.distanceMiles);
  const addressLabel = bar.addressLabel ?? 'Location coming soon';
  const closingLabel = formatClosingTimeLabel(bar.closesToday);
  const detailParts: string[] = [];
  if (distanceLabel) {
    detailParts.push(distanceLabel);
  }
  if (closingLabel) {
    detailParts.push(`Closes ${closingLabel}`);
  }
  const detailLine = detailParts.join(' • ');

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.barName, { color: cardTitle }]} numberOfLines={1}>
          {bar.name}
        </Text>
      </View>

      <View>
        <Text style={[styles.addressText, { color: cardSubtitle }]} numberOfLines={2}>
          {addressLabel}
        </Text>
      </View>

      {detailLine ? (
        <View style={styles.distanceDetailRow}>
          <MaterialIcons name="location-on" size={16} color={iconSelected} style={{ marginRight: 4 }} />
          <Text style={[styles.distanceDetail, { color: cardText }]}>{detailLine}</Text>
        </View>
      ) : null}

      {bar.tags.length > 0 ? (
        <View style={styles.tagList}>
          {bar.tags.slice(0, 4).map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: pillBackground, borderColor: pillBorder }]}
            >
              <Text style={[styles.tagText, { color: pillText }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {(bar.instagram || bar.twitter || bar.facebook) && (
        <View style={styles.socialRow}>
          {bar.instagram ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.instagram)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="instagram" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {bar.twitter ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.twitter)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="twitter" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {bar.facebook ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.facebook)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="facebook-square" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Props for tag filter bottom sheet
type TagFilterSheetProps = {
  visible: boolean;
  tags: TagFilterOption[];
  selectedTags: string[];
  onApply: (tagIds: string[]) => void;
  onClose: () => void;
  theme: ThemeName;
};

// Tag selection sheet (mirrors event filters UI)
const TagFilterSheet = ({ visible, tags, selectedTags, onApply, onClose, theme }: TagFilterSheetProps) => {
  const palette = Colors[theme];
  const highlightColor = palette.filterActivePill;
  const [draftSelection, setDraftSelection] = useState<string[]>(selectedTags);

  useEffect(() => {
    if (visible) {
      setDraftSelection(selectedTags);
    }
  }, [selectedTags, visible]);

  const toggleTag = useCallback((normalizedName: string) => {
    setDraftSelection((previous) =>
      previous.includes(normalizedName)
        ? previous.filter((id) => id !== normalizedName)
        : [...previous, normalizedName]
    );
  }, []);

  const handleApply = useCallback(() => {
    onApply(draftSelection);
    onClose();
  }, [draftSelection, onApply, onClose]);

  const handleClearAll = useCallback(() => {
    setDraftSelection([]);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.filterSheetScrim} onPress={onClose} />
      <View
        style={[
          styles.filterSheetContainer,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.filterSheetTitle, { color: palette.text }]}>Bar Tags</Text>

        <FlatList
          data={tags}
          keyExtractor={(item) => item.normalizedName}
          renderItem={({ item }) => {
            const isChecked = draftSelection.includes(item.normalizedName);
            return (
              <TouchableOpacity
                style={styles.filterSheetRow}
                onPress={() => toggleTag(item.normalizedName)}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
              >
                <MaterialIcons
                  name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={isChecked ? highlightColor : palette.text}
                  style={styles.filterSheetCheckbox}
                />
                <Text
                  style={[styles.filterSheetRowLabel, { color: isChecked ? palette.pillText : palette.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={tags.length === 0 ? styles.filterSheetEmptyContent : undefined}
          ListEmptyComponent={
            <View style={styles.filterSheetEmptyContent}>
              <Text style={[styles.filterSheetEmptyText, { color: palette.filterText }]}>No tags available.</Text>
            </View>
          }
          style={styles.filterSheetList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.filterSheetActionRow}>
          <TouchableOpacity
            onPress={handleClearAll}
            style={[
              styles.filterSheetActionButton,
              styles.filterSheetActionGhost,
              { borderColor: palette.pillBorder },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterSheetActionGhostText, { color: palette.text }]}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            style={[
              styles.filterSheetActionButton,
              styles.filterSheetActionPrimary,
              { backgroundColor: highlightColor },
            ]}
            activeOpacity={0.9}
          >
            <Text style={styles.filterSheetActionPrimaryText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Component to display empty state when no bars are available
const BarsEmptyState = ({ error, onRetry, theme }: { error: string | null; onRetry: () => void; theme: ThemeName }) => {
  const palette = Colors[theme];
  const networkErrorText = palette.networkErrorText;
  const networkErrorButton = palette.networkErrorButton;
  const networkErrorBackground = palette.networkErrorBackground;
  const networkErrorBorder = palette.networkErrorBorder;

  return (
    <View
      style={[
        styles.emptyState,
        error
          ? {
              backgroundColor: networkErrorBackground,
              borderColor: networkErrorBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 18,
              paddingHorizontal: 24,
              width: '90%',
              alignSelf: 'center',
            }
          : null,
      ]}
    >
      <Text style={[styles.emptyTitle, { color: networkErrorText }]}>
        {error ? 'Unable to load bars' : 'No bars to show'}
      </Text>
      <Text style={[styles.emptyDescription, { color: networkErrorText }]}>
        {error ? error : 'Check back soon for nearby watering holes.'}
      </Text>
      {error ? (
        <TouchableOpacity style={[styles.retryButton, { borderColor: networkErrorButton }]} onPress={onRetry}>
          <Text style={[styles.retryButtonText, { color: networkErrorButton }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// Component to display error banner
const ErrorBanner = ({ message, theme }: { message: string; theme: ThemeName }) => {
  const palette = Colors[theme];
  const warningBackground = palette.warningBackground;
  const warningBorder = palette.warningBorder;
  const warningText = palette.warningText;

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: warningBackground,
          borderColor: warningBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.errorBannerTitle, { color: warningText }]}>Unable to refresh</Text>
      <Text style={[styles.errorBannerMessage, { color: warningText }]}>{message}</Text>
    </View>
  );
};

// Component to display location permission banner
const LocationPermissionBanner = ({ theme, onOpenSettings, onRetry }: { theme: ThemeName; onOpenSettings: () => void; onRetry: () => void }) => {
  const palette = Colors[theme];
  const warningBackground = palette.warningBackground;
  const warningBorder = palette.warningBorder;
  const warningText = palette.warningText;
  const actionButton = palette.actionButton;
  const dismissButton = palette.dismissButton;

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: warningBackground,
          borderColor: warningBorder,
          borderWidth: 1,
        },
      ]}
    > 
      <Text style={[styles.errorBannerTitle, { color: warningText }]}>Location disabled</Text>
      <Text style={[styles.errorBannerMessage, { color: warningText }]}>Enable location in system settings to see nearby bars.</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <TouchableOpacity onPress={onOpenSettings} style={[styles.retryButton, { borderColor: actionButton }]}>
          <Text style={[styles.retryButtonText, { color: actionButton }]}>Open settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRetry} style={[styles.retryButton, { borderColor: dismissButton }]}>
          <Text style={[styles.retryButtonText, { color: dismissButton }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type SelectedTagEntry = {
  normalized: string;
  label: string;
};

// Component to display empty state when no bars match selected filters
const FilteredEmptyState = ({
  selectedTagEntries,
  onClear,
  theme,
}: {
  selectedTagEntries: SelectedTagEntry[];
  onClear: () => void;
  theme: ThemeName;
}) => {
  const palette = Colors[theme];
  const filterTextActive = palette.filterTextActive;
  const pillBorder = palette.border;
  const filterActivePill = palette.filterActivePill;
  const actionButton = palette.actionButton;
  const warningText = palette.warningText;
  const cardSubtitle = palette.cardSubtitle;

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: warningText}]}>No Open Bars Match Those Tags</Text>
      <Text style={[styles.emptyDescription, { color: cardSubtitle }]}>
        Try removing a few filters to see more watering holes.
      </Text>
      <View style={styles.selectedFilterTags}>
        {selectedTagEntries.map((entry) => (
          <View
            key={entry.normalized}
            style={[styles.selectedFilterTagPill, { backgroundColor: filterActivePill, borderColor: pillBorder }]}
          >
            <Text style={[styles.selectedFilterTagText, { color: palette.filterTextActive }]}>{entry.label}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.retryButton, { borderColor: actionButton }]} onPress={onClear}>
        <Text style={[styles.retryButtonText, { color: actionButton }]}>Clear filters</Text>
      </TouchableOpacity>
    </View>
  );
};

// Main screen component to display list of bars
export default function BarsScreen() {
  const colorScheme = useColorScheme();
  const theme = (colorScheme ?? 'light') as ThemeName;
  const palette = Colors[theme];
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    data: [],
    currentPage: 0,
    isLoading: true,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    totalCount: undefined,
  });
  const bars = pagination.data;
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationDeniedPermanently, setLocationDeniedPermanently] = useState(false);

  const listRef = useRef<FlatList<Bar>>(null);
  const lastScrollOffsetRef = useRef(0);
  const restorePendingRef = useRef(false);
  const inFlightPagesRef = useRef<Set<number>>(new Set());
  const activeRequestCountRef = useRef(0);
  const queuedRequestRef = useRef<{ page: number; mode: LoadMode; options?: { ignoreCache?: boolean; coordsOverride?: Coordinates } } | null>(null);
  const cacheRef = useRef<{
    key: string;
    timestamp: number;
    data: Bar[];
    currentPage: number;
    hasMore: boolean;
    totalCount?: number;
  } | null>(null);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const hasMoreRef = useRef(true);

  const errorMessage = pagination.error?.message ?? null;
  const { isLoading, isLoadingMore, hasMore, currentPage } = pagination;

  useEffect(() => {
    hasMoreRef.current = pagination.hasMore;
  }, [pagination.hasMore]);

  const getPageSize = useCallback((page: number) => {
    return page === 1
      ? INFINITE_SCROLL_CONFIG.initialPageSize
      : INFINITE_SCROLL_CONFIG.subsequentPageSize;
  }, []);

  const restoreScrollPosition = useCallback(() => {
    const offset = Math.max(0, lastScrollOffsetRef.current);
    if (listRef.current && offset > 0) {
      listRef.current.scrollToOffset({ offset, animated: false });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      restorePendingRef.current = true;
      const timer = setTimeout(() => {
        restoreScrollPosition();
        restorePendingRef.current = false;
      }, 50);
      return () => {
        clearTimeout(timer);
        restorePendingRef.current = true;
      };
    }, [restoreScrollPosition])
  );

  useEffect(() => {
    if (restorePendingRef.current && bars.length > 0) {
      restoreScrollPosition();
      restorePendingRef.current = false;
    }
  }, [bars.length, restoreScrollPosition]);

  const ensureLocationPermission = useCallback(async (): Promise<boolean> => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      setLocationDeniedPermanently(false);
      return true;
    }
    if (!current.canAskAgain) {
      setLocationDeniedPermanently(true);
      console.warn('Location permission permanently denied; using fallback coordinates.');
      return false;
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    const granted = requested.status === 'granted';
    setLocationDeniedPermanently(!granted && !requested.canAskAgain);
    return granted;
  }, []);

  const refreshUserLocation = useCallback(async (): Promise<Coordinates | null> => {
    try {
      const granted = await ensureLocationPermission();
      if (!granted) {
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      } satisfies Coordinates;
      setUserCoords(coords);
      return coords;
    } catch (err) {
      console.warn('Unable to fetch user location; using fallback coordinates.', err);
      return null;
    }
  }, [ensureLocationPermission]);

  const loadBarsPage = useCallback(
    async function loadBarsPage(page: number, mode: LoadMode = 'initial', options?: { ignoreCache?: boolean; coordsOverride?: Coordinates }) {
      const coordsToUse = options?.coordsOverride ?? userCoords ?? DEFAULT_COORDS;
      const normalizedTags = selectedTags;
      const cacheKey = getCacheKey(coordsToUse, normalizedTags);

      if (page === 1 && !options?.ignoreCache) {
        const cache = cacheRef.current;
        if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < INFINITE_SCROLL_CONFIG.cacheTimeout) {
          setPagination((prev) => ({
            ...prev,
            data: cache.data,
            currentPage: cache.currentPage,
            hasMore: cache.hasMore,
            totalCount: cache.totalCount,
            error: null,
            isLoading: false,
            isLoadingMore: false,
          }));
          setIsRefreshing(false);
          return;
        }
      }

      if (inFlightPagesRef.current.has(page)) {
        queuedRequestRef.current = { page, mode, options };
        return;
      }

      if (activeRequestCountRef.current >= INFINITE_SCROLL_CONFIG.maxConcurrentRequests) {
        queuedRequestRef.current = { page, mode, options: { ...options, ignoreCache: true } };
        return;
      }

      inFlightPagesRef.current.add(page);
      activeRequestCountRef.current += 1;

      if (mode === 'initial') {
        setPagination((prev) => ({ ...prev, isLoading: true, error: null }));
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
        setPagination((prev) => ({ ...prev, isLoading: false, isLoadingMore: false, currentPage: 0, hasMore: true, error: null }));
      } else if (mode === 'load-more' || mode === 'prefetch') {
        setPagination((prev) => ({ ...prev, isLoadingMore: true }));
      }

      const controller = new AbortController();
      abortControllersRef.current.set(page, controller);

      const pageSize = getPageSize(page);
      let nextHasMore: boolean | null = null;

      try {
        const queryParams: QueryParams = {
          ...BASE_QUERY_PARAMS,
          lat: coordsToUse.lat,
          lon: coordsToUse.lon,
          page,
          limit: pageSize,
          page_size: pageSize,
        };

        const queryString = buildQueryString(queryParams);
        const requestUrl = queryString ? `${barsEndpoint}?${queryString}` : barsEndpoint;
        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const items = extractBarItems(payload).map(mapToBar);
        nextHasMore = shouldContinuePagination(payload, items.length, pageSize);
        const totalCount = extractTotalCount(payload);

        hasMoreRef.current = nextHasMore ?? hasMoreRef.current;

        setPagination((prev) => {
          const replace = page === 1 || mode === 'refresh';
          const data = mergeBars(prev.data, items, replace);
          cacheRef.current = {
            key: cacheKey,
            timestamp: Date.now(),
            data,
            currentPage: page,
            hasMore: nextHasMore ?? prev.hasMore,
            totalCount,
          };
          return {
            ...prev,
            data,
            currentPage: page,
            hasMore: nextHasMore ?? prev.hasMore,
            totalCount: totalCount ?? prev.totalCount,
            error: null,
            isLoading: mode === 'initial' ? false : prev.isLoading,
            isLoadingMore: false,
          };
        });

        if (
          INFINITE_SCROLL_CONFIG.prefetchPages > 0 &&
          (mode === 'initial' || mode === 'refresh' || mode === 'load-more')
        ) {
          const prefetchTarget = page + INFINITE_SCROLL_CONFIG.prefetchPages;
          if (nextHasMore && !inFlightPagesRef.current.has(prefetchTarget)) {
            queuedRequestRef.current = null;
            loadBarsPage(prefetchTarget, 'prefetch', { ignoreCache: true, coordsOverride: coordsToUse });
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Something went wrong while loading bars.';
        setPagination((prev) => ({
          ...prev,
          error: new Error(message),
          isLoading: mode === 'initial' ? false : prev.isLoading,
          isLoadingMore: false,
        }));
      } finally {
        if (mode === 'refresh') {
          setIsRefreshing(false);
        }
        inFlightPagesRef.current.delete(page);
        activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
        abortControllersRef.current.delete(page);

        if (
          queuedRequestRef.current &&
          activeRequestCountRef.current < INFINITE_SCROLL_CONFIG.maxConcurrentRequests &&
          (queuedRequestRef.current.mode !== 'load-more' ? true : hasMoreRef.current)
        ) {
          const nextRequest = queuedRequestRef.current;
          queuedRequestRef.current = null;
          setTimeout(() => {
            loadBarsPage(nextRequest.page, nextRequest.mode, {
              ...(nextRequest.options ?? {}),
              ignoreCache: true,
            });
          }, 0);
        }
      }
    },
    [getPageSize, selectedTags, userCoords]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const coords = await refreshUserLocation();
      if (cancelled) return;
      const coordsToUse = coords ?? DEFAULT_COORDS;
      loadBarsPage(1, 'initial', { coordsOverride: coordsToUse });
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBarsPage, refreshUserLocation]);

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  const availableTags = useMemo<TagFilterOption[]>(() => {
    const tagMap = new Map<string, TagFilterOption>();
    bars.forEach((bar) => {
      bar.tags.forEach((tag) => {
        if (!tag.name) {
          return;
        }
        const normalizedName = normalizeTagName(tag.name);
        if (!normalizedName) {
          return;
        }
        const existing = tagMap.get(normalizedName);
        if (existing) {
          existing.count += 1;
        } else {
          tagMap.set(normalizedName, {
            id: normalizedName,
            name: tag.name,
            normalizedName,
            count: 1,
          });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bars]);

  const filteredBars = useMemo(() => {
    if (selectedTags.length === 0) {
      return bars;
    }
    const selectedSet = new Set(selectedTags);
    return bars.filter((bar) => {
      if (bar.tags.length === 0) {
        return false;
      }
      const barTagSet = new Set(
        bar.tags
          .map((tag) => normalizeTagName(tag.name))
          .filter((value) => value.length > 0)
      );
      for (const tag of selectedSet.values()) {
        if (!barTagSet.has(tag)) {
          return false;
        }
      }
      return true;
    });
  }, [bars, selectedTags]);

  const selectedTagEntries = useMemo<SelectedTagEntry[]>(() => {
    if (selectedTags.length === 0) {
      return [];
    }
    const lookup = new Map(availableTags.map((tag) => [tag.normalizedName, tag.name]));
    return selectedTags.map((normalized) => ({
      normalized,
      label: lookup.get(normalized) ?? normalized,
    }));
  }, [availableTags, selectedTags]);

  const handleApplyFilters = useCallback((nextTags: string[]) => {
    setSelectedTags(nextTags);
  }, []);

  const openFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(true);
  }, []);

  const closeFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const handleRemoveTag = useCallback((tagId: string) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId));
  }, []);

  useEffect(() => {
    refreshUserLocation();
  }, [refreshUserLocation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await refreshUserLocation();
      })();
      return () => {
        cancelled = true;
      };
    }, [refreshUserLocation])
  );

  const handleOpenSettings = useCallback(() => {
    if (typeof Linking.openSettings === 'function') {
      Linking.openSettings().catch((err) => {
        console.warn('Unable to open app settings.', err);
      });
      return;
    }
    Linking.openURL('app-settings:').catch((err) => {
      console.warn('Unable to open app settings.', err);
    });
  }, []);

  const handleRefresh = useCallback(() => {
    queuedRequestRef.current = null;
    inFlightPagesRef.current.forEach((page) => {
      const controller = abortControllersRef.current.get(page);
      controller?.abort();
    });
    inFlightPagesRef.current.clear();
    abortControllersRef.current.clear();
    activeRequestCountRef.current = 0;
    cacheRef.current = null;
    loadBarsPage(1, 'refresh', { ignoreCache: true });
  }, [loadBarsPage]);

  const handleRetry = useCallback(() => {
    const mode: LoadMode = bars.length ? 'refresh' : 'initial';
    queuedRequestRef.current = null;
    inFlightPagesRef.current.forEach((page) => {
      const controller = abortControllersRef.current.get(page);
      controller?.abort();
    });
    inFlightPagesRef.current.clear();
    abortControllersRef.current.clear();
    activeRequestCountRef.current = 0;
    cacheRef.current = null;
    loadBarsPage(1, mode, { ignoreCache: true });
  }, [bars.length, loadBarsPage]);

  const handleEndReached = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }
    const nextPage = Math.max(1, currentPage + 1);
    loadBarsPage(nextPage, 'load-more', { ignoreCache: true });
  }, [currentPage, hasMore, isLoading, isLoadingMore, loadBarsPage]);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const openBarDetail = useCallback(
    (barId: string) => {
      router.push({ pathname: '/bar/[barId]', params: { barId } });
    },
    [router]
  );

  const renderItem = useCallback<ListRenderItem<Bar>>(
    ({ item }) => (
      <BarCard
        bar={item}
        theme={theme}
        onPress={() => openBarDetail(item.id)}
      />
    ),
    [openBarDetail, theme]
  );

  const keyExtractor = useCallback((item: Bar) => item.id, []);

  const headerComponent =
    locationDeniedPermanently || availableTags.length > 0 || selectedTags.length > 0 || (bars.length > 0 && errorMessage)
      ? (
          <View style={styles.listHeader}>
            <Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Open Bars</Text>
            {locationDeniedPermanently ? (
              <LocationPermissionBanner
                theme={theme}
                onOpenSettings={handleOpenSettings}
                onRetry={refreshUserLocation}
              />
            ) : null}

            {availableTags.length > 0 || selectedTags.length > 0 ? (
              <View
                style={[
                  styles.filterCard,
                  { backgroundColor: palette.background},
                ]}
              >
                <View style={styles.filterButtonRow}>
                  <TouchableOpacity
                    onPress={openFilterSheet}
                    style={[styles.filterButton, styles.filterButtonLarge, { backgroundColor: palette.actionButton}]}
                    activeOpacity={0.9}
                  >
                    <MaterialIcons name="tune" size={18} color={palette.filterTextActive} style={styles.filterButtonIcon} />
                    <Text style={[styles.filterButtonText, { color: palette.filterTextActive }]}>Filters{selectedTags.length ? ` (${selectedTags.length})` : ''}</Text>
                  </TouchableOpacity>
                  {selectedTags.length ? (
                    <TouchableOpacity
                      onPress={handleClearFilters}
                      style={[styles.inlineClearButton, { borderColor: palette.filterActivePill }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.inlineClearText, { color: palette.filterActivePill }]}>Clear All</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {selectedTagEntries.length ? (
                  <View style={styles.selectedTagChipRow}>
                    {selectedTagEntries.map((entry) => (
                      <View
                        key={entry.normalized}
                        style={[styles.selectedTagChip, { borderColor: palette.border, backgroundColor: palette.filterContainer }]}
                      >
                        <Text style={[styles.selectedTagChipLabel, { color: palette.pillText }]} numberOfLines={1}>
                          {entry.label}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveTag(entry.normalized)}
                          style={[styles.selectedTagChipClose, { backgroundColor: palette.filterContainer }]}
                          hitSlop={6}
                        >
                          <MaterialIcons name="close" size={14} color={palette.text} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {bars.length > 0 && errorMessage ? <ErrorBanner message={errorMessage} theme={theme} /> : null}
          </View>
        )
      : null;

  const footerComponent = filteredBars.length > 0
    ? (
        isLoadingMore ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator size="small" color={palette.text} />
            <Text style={[styles.footerLoadingText, { color: palette.text }]}>Loading more bars...</Text>
          </View>
        ) : (
          <Text style={[styles.footerHint, { color: palette.text }]}>Pull to refresh for the latest list.</Text>
        )
      )
    : null;

  const listEmptyComponent =
    bars.length === 0 && !isLoading && !isRefreshing ? (
      <BarsEmptyState error={errorMessage} onRetry={handleRetry} theme={theme} />
    ) : filteredBars.length === 0 && selectedTags.length > 0 ? (
      <FilteredEmptyState
        selectedTagEntries={selectedTagEntries}
        onClear={handleClearFilters}
        theme={theme}
      />
    ) : null;

  if (isLoading && bars.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={palette.text} />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading nearby bars...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <FlatList
        ref={listRef}
        data={filteredBars}
        style={[styles.list, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.listContent}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmptyComponent}
        ListHeaderComponent={headerComponent}
        ListFooterComponent={footerComponent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.text} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={INFINITE_SCROLL_CONFIG.loadMoreThreshold}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <TagFilterSheet
        visible={isFilterSheetVisible}
        tags={availableTags}
        selectedTags={selectedTags}
        onApply={handleApplyFilters}
        onClose={closeFilterSheet}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 24,
  },
  listContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barName: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
		marginBottom: 5,
  },
  distanceText: {
    fontSize: 14,
    textAlign: 'right',
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
		fontWeight: '600',
		letterSpacing: 0.25,
		textTransform: 'none',
  },
  distanceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  distanceDetail: {
    fontSize: 14,
    fontWeight: '400',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
		fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footerHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  footerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerLoadingText: {
    fontSize: 14,
  },
  filterSection: {
    padding: 18,
    borderRadius: 20,
    gap: 16,
  },
  filterSectionLight: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  filterSectionDark: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterToggleIcon: {
    marginLeft: 2,
  },
  filterSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  clearFilterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipInactive: {
    borderStyle: 'solid',
  },

  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  filterToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorBannerMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectedFilterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedFilterTagPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedFilterTagText: {
    fontSize: 14,
  },
  filterCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 16,
    gap: 12,
  },
  filterButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 140,
  },
  filterButtonLarge: {
    minHeight: 48,
  },
  filterButtonIcon: {
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  inlineClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineClearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedTagsPreview: {
    fontSize: 14,
  },
  selectedTagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  selectedTagChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectedTagChipClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSheetScrim: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  filterSheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterSheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  filterSheetSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
  },
  filterSheetList: {
    maxHeight: 340,
  },
  filterSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  filterSheetCheckbox: {
    marginRight: 8,
  },
  filterSheetRowLabel: {
    fontSize: 15,
    flex: 1,
  },
  filterSheetEmptyContent: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  filterSheetEmptyText: {
    fontSize: 14,
  },
  filterSheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  filterSheetActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterSheetActionGhost: {
    backgroundColor: 'transparent',
  },
  filterSheetActionPrimary: {
    borderWidth: 0,
  },
  filterSheetActionGhostText: {
    fontSize: 15,
    fontWeight: '700',
  },
  filterSheetActionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
