import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FetchMode = 'initial' | 'refresh';
type ThemeName = keyof typeof Colors;
type LooseObject = Record<string, any>;

type BarTag = {
  id: string;
  name: string;
  category?: string;
};

type Bar = {
  id: string;
  name: string;
  addressLabel?: string;
  fullAddress?: string;
  instagram?: string;
  facebook?: string;
  distanceKm?: number;
  distanceMiles?: number;
  tags: BarTag[];
};

type TagFilterOption = {
  id: string;
  name: string;
  normalizedName: string;
  count: number;
};

const TAG_PREVIEW_COUNT = 3;
const FILTER_COLLAPSE_SCROLL_DELTA = 12;

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');
const barsEndpoint = normalizedBaseUrl ? `${normalizedBaseUrl}/bars` : '/get/bars';
const MILES_PER_KM = 0.621371;

const DEFAULT_LATITUDE = 42.34105265628477;
const DEFAULT_LONGITUDE = -71.0521475972448;

type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue>;

const DEFAULT_QUERY_PARAMS: QueryParams = {
  unit: 'miles',
  lat: DEFAULT_LATITUDE,
  lon: DEFAULT_LONGITUDE,
  open_now: true,
  include: 'tags',
};

const buildQueryString = (params: QueryParams): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

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

const mapToBar = (raw: LooseObject, index: number): Bar => {
  const idSource =
    raw.id ??
    raw.bar_id ??
    raw.uuid ??
    raw.slug ??
    raw.external_id ??
    `bar-${index}`;

  const location = (raw.address ?? raw.location ?? {}) as LooseObject;
  const street =
    raw.address_street ??
    raw.street ??
    raw.addressLine1 ??
    location.street ??
    location.line1 ??
    location.address;
  const city = raw.address_city ?? raw.city ?? location.city;
  const state = raw.address_state ?? raw.state ?? location.state;
  const zip = raw.address_zip ?? raw.zip ?? raw.postal_code ?? location.zip;

  const addressSegments: string[] = [];
  if (street) {
    addressSegments.push(String(street));
  }

  const cityState = [city, state].filter(Boolean).join(', ');
  if (cityState || zip) {
    const combined = [cityState, zip].filter(Boolean).join(' ');
    if (combined.trim().length > 0) {
      addressSegments.push(combined.trim());
    }
  }

  const fullAddress = addressSegments.length > 0 ? addressSegments.join(', ') : undefined;
  const rawAddressLabel = fullAddress ?? addressSegments.join(', ');
  const addressLabel = rawAddressLabel && rawAddressLabel.trim().length > 0 ? rawAddressLabel : undefined;
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

  return {
    id: String(idSource),
    name: raw.name ?? raw.title ?? 'Unnamed bar',
    addressLabel,
    fullAddress,
    instagram: raw.instagram ?? undefined,
    facebook: raw.facebook ?? undefined,
    distanceKm,
    distanceMiles,
    tags: dedupedTags,
  };
};

const normalizeTagName = (value: string): string => value.trim().toLowerCase();

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

const ensureProtocol = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
};

const openExternalLink = async (value: string) => {
  if (!value) {
    return;
  }

  try {
    await Linking.openURL(ensureProtocol(value));
  } catch (error) {
    console.warn('Unable to open URL', error);
  }
};

const openMapsForAddress = async (value?: string) => {
  if (!value) {
    return;
  }

  const encoded = encodeURIComponent(value);
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Unable to open maps', error);
  }
};

type BarCardProps = {
  bar: Bar;
  theme: ThemeName;
  onPress?: () => void;
};

const BarCard = ({ bar, theme, onPress }: BarCardProps) => {
  const palette = Colors[theme];
  const mutedColor = theme === 'light' ? '#5c6672' : '#a7adb4';
  const secondaryMutedColor = theme === 'light' ? '#6c7682' : '#9298a0';
  const cardTone = theme === 'light' ? styles.cardLight : styles.cardDark;
  const pillBackground = theme === 'light' ? '#f1f5f9' : '#252a30';
  const pillBorder = theme === 'light' ? '#e2e8f0' : '#2e3339';
  const distanceLabel = formatDistanceLabel(bar.distanceMiles);
  const addressLabel = bar.fullAddress ?? bar.addressLabel ?? 'Address coming soon';
  const canOpenMaps = Boolean(bar.fullAddress);

  return (
    <TouchableOpacity
      style={[styles.card, cardTone]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.barName, { color: palette.text }]} numberOfLines={1}>
          {bar.name}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.addressTouchable}
        activeOpacity={canOpenMaps ? 0.7 : 1}
        disabled={!canOpenMaps}
        onPress={() => openMapsForAddress(bar.fullAddress)}
      >
        <Text style={[styles.addressText, { color: mutedColor }]} numberOfLines={2}>
          {addressLabel}
        </Text>
      </TouchableOpacity>

      {typeof bar.distanceMiles === 'number' ? (
        <View style={styles.distanceDetailRow}>
          <MaterialIcons name="location-on" size={16} color={secondaryMutedColor} style={{ marginRight: 4 }} />
          <Text style={[styles.distanceDetail, { color: secondaryMutedColor }]}> 
            {bar.distanceMiles.toFixed(2)} miles away
          </Text>
        </View>
      ) : null}

      {bar.tags.length > 0 ? (
        <View style={styles.tagList}>
          {bar.tags.slice(0, 4).map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: pillBackground, borderColor: pillBorder }]}
            >
              <Text style={[styles.tagText, { color: mutedColor }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {(bar.facebook || bar.instagram) && (
        <View style={styles.socialRow}>
          {bar.facebook ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.facebook)}
              style={[styles.socialButton, { borderColor: palette.tint }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="facebook-square" size={16} color={palette.tint} />
            </TouchableOpacity>
          ) : null}
          {bar.instagram ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.instagram)}
              style={[styles.socialButton, { borderColor: palette.tint }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="instagram" size={16} color={palette.tint} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

type TagFilterPanelProps = {
  tags: TagFilterOption[];
  selectedTags: string[];
  filtersExpanded: boolean;
  onToggleExpand: () => void;
  onExpand: () => void;
  onToggleTag: (tagName: string) => void;
  onClearTags: () => void;
  theme: ThemeName;
};

const TagFilterPanel = ({
  tags,
  selectedTags,
  filtersExpanded,
  onToggleExpand,
  onExpand,
  onToggleTag,
  onClearTags,
  theme,
}: TagFilterPanelProps) => {
  const palette = Colors[theme];
  const highlightColor = theme === 'light' ? '#f5a524' : '#f6c15b';
  const highlightText = theme === 'light' ? '#1e1202' : '#120900';
  const inactiveBackground = theme === 'light' ? '#f8fafc' : '#1e242d';
  const inactiveBorder = theme === 'light' ? '#dce2ec' : '#2c333c';
  const inactiveText = theme === 'light' ? '#475569' : '#c7d0de';
  const subtleText = theme === 'light' ? '#64748b' : '#9ba5ba';
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const orderedTags = useMemo(() => {
    if (selectedTags.length === 0) {
      return tags;
    }
    const prioritized: TagFilterOption[] = [];
    const remaining: TagFilterOption[] = [];
    tags.forEach((tag) => {
      if (selectedTagSet.has(tag.normalizedName)) {
        prioritized.push(tag);
      } else {
        remaining.push(tag);
      }
    });
    return [...prioritized, ...remaining];
  }, [tags, selectedTags, selectedTagSet]);
  const hasHiddenTags = tags.length > TAG_PREVIEW_COUNT;
  const displayTags = filtersExpanded || !hasHiddenTags ? orderedTags : orderedTags.slice(0, TAG_PREVIEW_COUNT);

  const handleChipPress = (tagName: string) => {
    if (hasHiddenTags && !filtersExpanded) {
      onExpand();
      // Allow the dropdown to open while still applying the selection.
    }
    onToggleTag(tagName);
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.filterSection,
        theme === 'light' ? styles.filterSectionLight : styles.filterSectionDark,
      ]}
    >
      <View style={styles.filterHeaderRow}>
        <TouchableOpacity
          style={styles.filterTitleButton}
          activeOpacity={hasHiddenTags ? 0.8 : 1}
          onPress={hasHiddenTags ? onToggleExpand : undefined}
          disabled={!hasHiddenTags}
        >
          <Text style={[styles.filterTitle, { color: palette.text }]}>Filters</Text>
        </TouchableOpacity>
        {selectedTags.length > 0 ? (
          <TouchableOpacity
            onPress={onClearTags}
            style={[styles.clearFilterButton, { borderColor: highlightColor }]}
            accessibilityRole="button"
          >
            <Text style={[styles.clearFilterText, { color: highlightColor }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.filterChipContainer}>
        {displayTags.map((tag) => {
          const isActive = selectedTagSet.has(tag.normalizedName);
          return (
            <TouchableOpacity
              key={tag.id}
              onPress={() => handleChipPress(tag.name)}
              activeOpacity={0.85}
              style={[
                styles.filterChip,
                isActive
                  ? [
                      styles.filterChipActive,
                      { backgroundColor: highlightColor, borderColor: highlightColor },
                    ]
                  : [
                      styles.filterChipInactive,
                      { backgroundColor: inactiveBackground, borderColor: inactiveBorder },
                    ],
              ]}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isActive ? highlightText : inactiveText },
                ]}
                numberOfLines={1}
              >
                {tag.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {hasHiddenTags ? (
        <TouchableOpacity
          onPress={onToggleExpand}
          style={styles.filterToggleRow}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={[styles.filterToggleLabel, { color: highlightColor }]}>
            {filtersExpanded ? 'Hide tags' : `Show all (${tags.length})`}
          </Text>
          <MaterialIcons
            name={filtersExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={20}
            color={highlightColor}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const BarsEmptyState = ({ error, onRetry, theme }: { error: string | null; onRetry: () => void; theme: ThemeName }) => {
  const palette = Colors[theme];
  const mutedColor = theme === 'light' ? '#5c6672' : '#a7adb4';

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        {error ? 'Unable to load bars' : 'No bars to show'}
      </Text>
      <Text style={[styles.emptyDescription, { color: mutedColor }]}>
        {error ? error : 'Check back soon for nearby watering holes.'}
      </Text>
      {error ? (
        <TouchableOpacity style={[styles.retryButton, { borderColor: palette.tint }]} onPress={onRetry}>
          <Text style={[styles.retryButtonText, { color: palette.tint }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const ErrorBanner = ({ message, theme }: { message: string; theme: ThemeName }) => {
  const palette = Colors[theme];
  const mutedColor = theme === 'light' ? '#5c6672' : '#a7adb4';

  return (
    <View style={[styles.errorBanner, { backgroundColor: theme === 'light' ? '#fff3cd' : '#3a2f14' }]}>
      <Text style={[styles.errorBannerTitle, { color: palette.text }]}>Unable to refresh</Text>
      <Text style={[styles.errorBannerMessage, { color: mutedColor }]}>{message}</Text>
    </View>
  );
};

type SelectedTagEntry = {
  normalized: string;
  label: string;
};

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
  const mutedColor = theme === 'light' ? '#5c6672' : '#a7adb4';
  const chipBackground = theme === 'light' ? '#fff6e8' : '#2a1d10';
  const chipBorder = theme === 'light' ? '#f5a524' : '#f6c15b';

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>No bars match those tags</Text>
      <Text style={[styles.emptyDescription, { color: mutedColor }]}>
        Try removing a few filters to see more watering holes.
      </Text>
      <View style={styles.selectedFilterTags}>
        {selectedTagEntries.map((entry) => (
          <View
            key={entry.normalized}
            style={[styles.selectedFilterTagPill, { backgroundColor: chipBackground, borderColor: chipBorder }]}
          >
            <Text style={[styles.selectedFilterTagText, { color: palette.text }]}>{entry.label}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.retryButton, { borderColor: palette.tint }]} onPress={onClear}>
        <Text style={[styles.retryButtonText, { color: palette.tint }]}>Clear filters</Text>
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScrollOffset = useRef(0);

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

  const hasExpandableFilters = availableTags.length > TAG_PREVIEW_COUNT;

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

  const handleToggleTag = useCallback((tagName: string) => {
    const normalized = normalizeTagName(tagName);
    setSelectedTags((prev) =>
      prev.includes(normalized) ? prev.filter((tag) => tag !== normalized) : [...prev, normalized]
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const handleToggleFilterDropdown = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  const handleExpandFilters = useCallback(() => {
    setFiltersExpanded(true);
  }, []);

  useEffect(() => {
    if (!hasExpandableFilters && filtersExpanded) {
      setFiltersExpanded(false);
    }
  }, [hasExpandableFilters, filtersExpanded]);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!filtersExpanded || !hasExpandableFilters) {
        lastScrollOffset.current = event.nativeEvent.contentOffset.y;
        return;
      }

      const currentOffset = event.nativeEvent.contentOffset.y;
      const previousOffset = lastScrollOffset.current;
      lastScrollOffset.current = currentOffset;

      const isScrollingUp = previousOffset - currentOffset > FILTER_COLLAPSE_SCROLL_DELTA;
      if (isScrollingUp && currentOffset >= 0) {
        setFiltersExpanded(false);
      }
    },
    [filtersExpanded, hasExpandableFilters]
  );

  const fetchBars = useCallback(
    async (mode: FetchMode = 'initial', signal?: AbortSignal) => {
      const setBusy = mode === 'refresh' ? setIsRefreshing : setIsLoading;
      setBusy(true);

      try {
        const queryString = buildQueryString(DEFAULT_QUERY_PARAMS);
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
    [barsEndpoint]
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
    ({ item }) => <BarCard bar={item} theme={theme} onPress={() => openBarDetail(item.id)} />,
    [openBarDetail, theme]
  );

  const keyExtractor = useCallback((item: Bar) => item.id, []);

  const headerComponent =
    availableTags.length > 0 || (bars.length > 0 && error)
      ? (
          <View style={styles.listHeader}>
            {availableTags.length > 0 ? (
              <TagFilterPanel
                tags={availableTags}
                selectedTags={selectedTags}
                filtersExpanded={filtersExpanded}
                onToggleExpand={handleToggleFilterDropdown}
                onExpand={handleExpandFilters}
                onToggleTag={handleToggleTag}
                onClearTags={handleClearFilters}
                theme={theme}
              />
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
        style={styles.list}
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
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  listContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listHeader: {
    paddingBottom: 16,
    gap: 16,
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
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
  },
  cardDark: {
    backgroundColor: '#1b1f23',
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    borderWidth: 1,
    borderColor: 'rgba(245, 165, 36, 0.35)',
    backgroundColor: '#fff9ef',
  },
  filterSectionDark: {
    borderWidth: 1,
    borderColor: 'rgba(246, 193, 91, 0.35)',
    backgroundColor: '#1f1a13',
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
    fontSize: 16,
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
  filterChipActive: {
    shadowColor: '#f59e0b',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
});
