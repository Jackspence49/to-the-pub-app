import { FontAwesome, MaterialIcons } from '@expo/vector-icons'; // Icon libraries
import * as Location from 'expo-location'; // Location services
import { useFocusEffect, useRouter } from 'expo-router'; // Navigation hooks 
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type FetchMode = 'initial' | 'refresh';
type ThemeName = keyof typeof Colors;
type LooseObject = Record<string, any>;

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



// API and utility constants
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();  // Base URL for API requests
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');  
const barsEndpoint = normalizedBaseUrl ? `${normalizedBaseUrl}/bars` : '/get/bars';
const MILES_PER_KM = 0.621371;

type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue>;
type Coordinates = { lat: number; lon: number };

const DEFAULT_COORDS: Coordinates = {
  lat: 42.3555,
  lon: -71.0565,
};

// Default query parameters for API requests
const BASE_QUERY_PARAMS: QueryParams = {
  unit: 'miles',
  open_now: true,
  include: 'tags,hours',
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
  const titleColor = palette.cardTitle;
  const cardSubtitle = palette.cardSubtitle;
  const cardText = palette.cardText;
  const cardSurface = palette.cardSurface;
  const cardBorder = palette.border;
  const pillBackground = palette.pillBackground;
  const pillBorder = palette.border;
  const pillText = palette.pillText;
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
        <Text style={[styles.barName, { color: titleColor }]} numberOfLines={1}>
          {bar.name}
        </Text>
      </View>

      <View style={styles.addressTouchable}>
        <Text style={[styles.addressText, { color: cardSubtitle }]} numberOfLines={2}>
          {addressLabel}
        </Text>
      </View>

      {detailLine ? (
        <View style={styles.distanceDetailRow}>
          <MaterialIcons name="location-on" size={16} color={cardText} style={{ marginRight: 4 }} />
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.filterSheetScrim} onPress={onClose} />
      <View
        style={[
          styles.filterSheetContainer,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <View style={styles.filterSheetHandle} />
        <Text style={[styles.filterSheetTitle, { color: palette.text }]}>Filter bars</Text>

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
                <Text style={[styles.filterSheetRowLabel, { color: palette.text }]} numberOfLines={1}>
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
              { borderColor: palette.border },
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
      <Text style={[styles.emptyTitle, { color: warningText}]}>No bars match those tags</Text>
      <Text style={[styles.emptyDescription, { color: cardSubtitle }]}>
        Try removing a few filters to see more watering holes.
      </Text>
      <View style={styles.selectedFilterTags}>
        {selectedTagEntries.map((entry) => (
          <View
            key={entry.normalized}
            style={[styles.selectedFilterTagPill, { backgroundColor: filterActivePill, borderColor: pillBorder }]}
          >
            <Text style={[styles.selectedFilterTagText, { color: filterTextActive }]}>{entry.label}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.retryButton, { borderColor: actionButton }]} onPress={onClear}>
        <Text style={[styles.retryButtonText, { color: actionButton }]}>Clear filters</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function BarsScreen() {
  const colorScheme = useColorScheme();
  const theme = (colorScheme ?? 'light') as ThemeName;
  const palette = Colors[theme];
  const router = useRouter();
  const [bars, setBars] = useState<Bar[]>([]);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDeniedPermanently, setLocationDeniedPermanently] = useState(false);

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

  const refreshUserLocation = useCallback(async () => {
    try {
      const granted = await ensureLocationPermission();
      if (!granted) {
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserCoords({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
    } catch (err) {
      console.warn('Unable to fetch user location; using fallback coordinates.', err);
    }
  }, [ensureLocationPermission]);

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

  const selectedTagNames = useMemo(() => selectedTagEntries.map((entry) => entry.label), [selectedTagEntries]);

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

  const fetchBars = useCallback(
    async (mode: FetchMode = 'initial', signal?: AbortSignal, coordsOverride?: Coordinates) => {
      const setBusy = mode === 'refresh' ? setIsRefreshing : setIsLoading;
      setBusy(true);

      try {
        const coordsToUse = coordsOverride ?? userCoords ?? DEFAULT_COORDS;
        const queryParams: QueryParams = {
          ...BASE_QUERY_PARAMS,
          lat: coordsToUse.lat,
          lon: coordsToUse.lon,
        };

        const queryString = buildQueryString(queryParams);
        const requestUrl = queryString ? `${barsEndpoint}?${queryString}` : barsEndpoint;
        const response = await fetch(requestUrl, { signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const items = extractBarItems(payload).map(mapToBar);
        setBars(items);
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Something went wrong while loading bars.';
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [userCoords]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBars('initial', controller.signal);
    return () => controller.abort();
  }, [fetchBars]);

  const handleRefresh = useCallback(() => {
    fetchBars('refresh');
  }, [fetchBars]);

  const handleRetry = useCallback(() => {
    fetchBars('initial');
  }, [fetchBars]);

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
    locationDeniedPermanently || availableTags.length > 0 || selectedTags.length > 0 || (bars.length > 0 && error)
      ? (
          <View style={styles.listHeader}>
            <Text style={[styles.screenTitle, { color: palette.text }]}>Open Bars</Text>
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
                  { backgroundColor: palette.filterContainer, borderColor: palette.border },
                ]}
              >
                <View style={styles.filterButtonRow}>
                  <TouchableOpacity
                    onPress={openFilterSheet}
                    style={[styles.filterButton, { borderColor: palette.border }]}
                    activeOpacity={0.9}
                  >
                    <MaterialIcons name="tune" size={18} color={palette.text} style={styles.filterButtonIcon} />
                    <Text style={[styles.filterButtonText, { color: palette.text }]}>Filters{selectedTags.length ? ` (${selectedTags.length})` : ''}</Text>
                  </TouchableOpacity>
                  {selectedTags.length ? (
                    <TouchableOpacity
                      onPress={handleClearFilters}
                      style={[styles.inlineClearButton, { borderColor: palette.filterActivePill }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.inlineClearText, { color: palette.filterActivePill }]}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {selectedTagNames.length ? (
                  <Text style={[styles.selectedTagsPreview, { color: palette.filterText }]}>
                    {selectedTagNames.slice(0, 2).join(', ')}
                    {selectedTags.length > 2 ? ` +${selectedTags.length - 2} more` : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {bars.length > 0 && error ? <ErrorBanner message={error} theme={theme} /> : null}
          </View>
        )
      : null;

  const footerComponent = bars.length > 0 && filteredBars.length > 0 ? (
    <Text style={[styles.footerHint, { color: theme === 'light' ? '#5c6672' : '#a7adb4' }]}>Pull to refresh for the latest list.</Text>
  ) : null;

  const listEmptyComponent =
    bars.length === 0 ? (
      <BarsEmptyState error={error} onRetry={handleRetry} theme={theme} />
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
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading nearby bars...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <FlatList
        data={filteredBars}
        style={[styles.list, { backgroundColor: palette.background }]}
        contentContainerStyle={
          filteredBars.length === 0
            ? [styles.listContent, styles.listContentCentered]
            : styles.listContent
        }
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmptyComponent}
        ListHeaderComponent={headerComponent}
        ListFooterComponent={footerComponent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.tint} />}
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
    paddingBottom: 16,
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
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    shadowColor: '#000000',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  distanceText: {
    fontSize: 14,
    textAlign: 'right',
  },
  addressTouchable: {
    marginTop: 12,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  distanceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  distanceDetail: {
    fontSize: 13,
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterButtonIcon: {
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
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
  filterSheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  filterSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#9ca3af',
    marginBottom: 12,
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
