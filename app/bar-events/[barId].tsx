import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeName = keyof typeof Colors;
type FetchMode = 'initial' | 'refresh' | 'paginate';
type QueryValue = string | number | boolean | undefined;
type LooseObject = Record<string, any>;

type EventInstance = {
  id: string;
  instanceId: string;
  eventId?: string;
  title: string;
  description?: string;
  barName?: string;
  startsAt?: string;
  endsAt?: string;
  venueName?: string;
  cityState?: string;
  heroImageUrl?: string;
  tags?: string[];
  eventTagName?: string;
  eventDate?: string;
  crossesMidnight?: boolean;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');
const PAGE_SIZE = 6;

const getEventThemeTokens = (theme: ThemeName) => {
  const isLight = theme === 'light';
  return {
    pageBackground: isLight ? '#f5f5f5' : '#050608',
    headerBackground: isLight ? '#ffffff' : '#161a20',
    headerBorder: isLight ? '#e5e7eb' : '#2a2f36',
    headingText: isLight ? '#111827' : '#f3f4f6',
    subheadingText: isLight ? '#6b7280' : '#9ca3af',
    cardBackground: isLight ? '#ffffff' : '#191f28',
    cardBorder: isLight ? '#e5e7eb' : '#2b313c',
    cardShadowColor: isLight ? '#111827' : '#000000',
    cardShadowOpacity: isLight ? 0.05 : 0.35,
    imageBackground: isLight ? '#f3f4f6' : '#101318',
    imagePlaceholderText: isLight ? '#9ca3af' : '#6b7280',
    eventBarLabel: isLight ? '#6b7280' : '#a0a8ba',
    eventTitle: isLight ? '#111827' : '#f8fafc',
    eventMeta: isLight ? '#4b5563' : '#cbd5f5',
    timeBorder: isLight ? '#e5e7eb' : '#2f3642',
    timeBackground: isLight ? '#f9fafb' : '#10131a',
    timeLabel: isLight ? '#6b7280' : '#a3acc2',
    timeValue: isLight ? '#111827' : '#f3f4f6',
    footerText: isLight ? '#6b7280' : '#9ca3af',
    indicator: isLight ? '#111827' : '#f8fafc',
    accent: Colors[theme]?.tint ?? '#2563eb',
  };
};

type EventThemeTokens = ReturnType<typeof getEventThemeTokens>;

const normalizeDateOnly = (value?: string, offsetDays = 0): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (offsetDays) {
    date.setDate(date.getDate() + offsetDays);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const combineDateAndTime = (
  dateValue?: string,
  timeValue?: string,
  options?: { offsetDays?: number }
): string | undefined => {
  if (!dateValue || !timeValue) {
    return undefined;
  }
  const datePart = normalizeDateOnly(dateValue, options?.offsetDays ?? 0);
  if (!datePart) {
    return undefined;
  }
  return `${datePart}T${timeValue}`;
};

const isWithinCurrentWeek = (date: Date): boolean => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return date >= startOfWeek && date <= endOfWeek;
};

const formatEventDay = (value?: string): string => {
  if (!value) {
    return 'Date coming soon';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date coming soon';
  }
  if (isWithinCurrentWeek(date)) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatEventTime = (value?: string): string => {
  if (!value) {
    return 'Time TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Time TBD';
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const buildQueryString = (params: Record<string, QueryValue>): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

const extractEventItems = (payload: unknown): LooseObject[] => {
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
    record.data?.items,
    record.data?.data,
    record.data,
    record.items,
    record.results,
    record.event_instances,
    record.events,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as LooseObject[];
    }
  }
  return [];
};

const extractPaginationMeta = (payload: unknown): LooseObject | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as LooseObject;
  const metaBuckets = [record.meta?.pagination, record.meta, record.pagination, record.data?.pagination];
  for (const bucket of metaBuckets) {
    if (bucket && typeof bucket === 'object') {
      return bucket as LooseObject;
    }
  }
  return null;
};

const shouldKeepPaginating = (payload: unknown, receivedCount: number): boolean => {
  const pagination = extractPaginationMeta(payload);
  if (pagination) {
    if (typeof pagination.has_next_page === 'boolean') {
      return pagination.has_next_page;
    }
    if (typeof pagination.next_page !== 'undefined') {
      return Boolean(pagination.next_page);
    }
    const current =
      pagination.current_page ?? pagination.page ?? pagination.page_number ?? pagination.pageNumber;
    const total = pagination.total_pages ?? pagination.totalPages;
    if (typeof current === 'number' && typeof total === 'number') {
      return current < total;
    }
  }
  return receivedCount === PAGE_SIZE;
};

const mergeEvents = (current: EventInstance[], incoming: EventInstance[]): EventInstance[] => {
  if (current.length === 0) {
    return incoming;
  }
  const next = [...current];
  incoming.forEach((event) => {
    const index = next.findIndex((item) => item.id === event.id);
    if (index === -1) {
      next.push(event);
    } else {
      next[index] = event;
    }
  });
  return next;
};

const mapToEventInstance = (raw: LooseObject): EventInstance => {
  const fallbackLabel = `${raw.name ?? raw.title ?? 'event'}-${raw.start_time ?? raw.starts_at ?? Date.now()}`;
  const primaryId =
    raw.instance_id ??
    raw.event_instance_id ??
    raw.id ??
    raw.uuid ??
    raw.event_id ??
    raw.eventId ??
    fallbackLabel;
  const eventIdSource = raw.event_id ?? raw.eventId ?? raw.parent_event_id ?? undefined;
  const tags = Array.isArray(raw.tags)
    ? (raw.tags
        .map((tag: any) => {
          if (typeof tag === 'string') {
            return tag;
          }
          if (tag && typeof tag === 'object') {
            return tag.name ?? tag.title ?? tag.slug;
          }
          return undefined;
        })
        .filter(Boolean) as string[])
    : undefined;
  const derivedVenueName =
    raw.venue?.name ??
    raw.venue_name ??
    raw.location_name ??
    (typeof raw.venue === 'string' ? raw.venue : undefined);
  const barName = raw.bar_name ?? raw.bar?.name ?? derivedVenueName;
  const venueName = barName ?? derivedVenueName;
  const city =
    raw.address_city ??
    raw.bar?.address_city ??
    raw.venue?.city ??
    raw.city ??
    raw.location_city;
  const state =
    raw.address_state ??
    raw.bar?.address_state ??
    raw.venue?.state ??
    raw.state ??
    raw.location_state;
  const cityState = city && state ? `${city}, ${state}` : city ?? state ?? undefined;
  const crossesMidnight = Boolean(raw.crosses_midnight ?? raw.crossesMidnight ?? false);
  const dateSource = raw.date ?? raw.event_date ?? raw.starts_at ?? raw.start ?? undefined;
  const eventDate = raw.date ?? raw.event_date ?? undefined;
  const startDateTime =
    raw.starts_at ??
    raw.start ??
    combineDateAndTime(dateSource, raw.start_time ?? raw.start_time_formatted) ??
    combineDateAndTime(raw.date, raw.start_time ?? raw.start_time_formatted) ??
    undefined;
  const endDateTime =
    raw.ends_at ??
    raw.end ??
    combineDateAndTime(dateSource, raw.end_time ?? raw.end_time_formatted, {
      offsetDays: crossesMidnight ? 1 : 0,
    }) ??
    combineDateAndTime(raw.date, raw.end_time ?? raw.end_time_formatted, {
      offsetDays: crossesMidnight ? 1 : 0,
    }) ??
    undefined;
  const eventTagNameSources = [
    raw.event_tag?.name,
    raw.event_tag?.title,
    raw.event_tag?.label,
    raw.event_tag_name,
    raw.eventTagName,
    raw.tag_name,
    raw.tagName,
    raw.tag?.name,
    raw.tag?.title,
    raw.tag?.label,
  ];
  let eventTagName: string | undefined;
  for (const source of eventTagNameSources) {
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (trimmed.length > 0) {
        eventTagName = trimmed;
        break;
      }
    }
  }
  if (!eventTagName && typeof raw.event_tag === 'string') {
    const trimmed = raw.event_tag.trim();
    if (/[A-Za-z]/.test(trimmed)) {
      eventTagName = trimmed;
    }
  }
  if (!eventTagName && typeof raw.event_tag?.slug === 'string') {
    const trimmed = raw.event_tag.slug.trim();
    if (trimmed.length > 0) {
      eventTagName = trimmed;
    }
  }
  return {
    id: String(primaryId),
    instanceId: String(primaryId),
    eventId: eventIdSource ? String(eventIdSource) : undefined,
    title: raw.title ?? raw.name ?? 'Untitled event',
    description: raw.description ?? raw.summary ?? raw.subtitle ?? undefined,
    barName,
    startsAt: startDateTime ?? raw.begin_at ?? undefined,
    endsAt: endDateTime ?? undefined,
    venueName,
    cityState,
    heroImageUrl: raw.hero_image_url ?? raw.image_url ?? raw.banner_url ?? raw.cover_photo ?? undefined,
    tags,
    eventTagName,
    eventDate: eventDate ?? startDateTime,
    crossesMidnight,
  };
};

type EventCardProps = {
  event: EventInstance;
  tokens: EventThemeTokens;
  onPress?: () => void;
};

const EventCard = ({ event, tokens, onPress }: EventCardProps) => {
  const primaryTagLabel = useMemo(() => {
    const tagName = event.eventTagName?.trim();
    const fallbackTag = event.tags?.find((tag) => typeof tag === 'string' && tag.trim().length > 0);
    const finalTag = tagName || (fallbackTag ? fallbackTag.trim() : undefined);
    return finalTag ?? 'Event Tag';
  }, [event.eventTagName, event.tags]);
  const dateLabel = formatEventDay(event.eventDate ?? event.startsAt);
  const startTimeLabel = formatEventTime(event.startsAt);
  const endTimeLabel = formatEventTime(event.endsAt);
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: tokens.cardBackground,
          borderColor: tokens.cardBorder,
          shadowColor: tokens.cardShadowColor,
          shadowOpacity: tokens.cardShadowOpacity,
        },
      ]}
    >
      <View style={styles.cardBody}>
        <View style={[styles.tagPill, { borderColor: tokens.accent }]}>
          <Text style={[styles.tagLabel, { color: tokens.accent }]}>{primaryTagLabel}</Text>
        </View>
        <Text style={[styles.eventTitle, { color: tokens.eventTitle }]}>{event.title}</Text>
        <Text style={[styles.dateText, { color: tokens.eventMeta }]}>{dateLabel}</Text>

        <View
          style={[
            styles.timeRow,
            { borderColor: tokens.timeBorder, backgroundColor: tokens.timeBackground },
          ]}
        >
          <View style={styles.timeColumn}>
            <Text style={[styles.timeLabel, { color: tokens.timeLabel }]}>Start</Text>
            <Text style={[styles.timeValue, { color: tokens.timeValue }]}>{startTimeLabel}</Text>
          </View>
          <View
            style={[
              styles.timeColumn,
              styles.timeColumnDivider,
              { borderLeftColor: tokens.timeBorder },
            ]}
          >
            <Text style={[styles.timeLabel, { color: tokens.timeLabel }]}>End</Text>
            <Text style={[styles.timeValue, { color: tokens.timeValue }]}>{endTimeLabel}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function BarEventsScreen() {
  const { barId, barName } = useLocalSearchParams<{ barId?: string; barName?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = (colorScheme ?? 'light') as ThemeName;
  const tokens = useMemo(() => getEventThemeTokens(theme), [theme]);

  const [events, setEvents] = useState<EventInstance[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (pageToLoad: number, mode: FetchMode) => {
      if (mode === 'paginate') {
        setIsPaginating(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      if (!barId) {
        setError('Missing bar identifier.');
        setIsInitialLoading(false);
        setIsRefreshing(false);
        setIsPaginating(false);
        return;
      }

      if (!API_BASE_URL) {
        setError('Set EXPO_PUBLIC_API_URL in your .env file to load events.');
        setIsInitialLoading(false);
        setIsRefreshing(false);
        setIsPaginating(false);
        return;
      }

      try {
        setError(null);
        const queryParams: Record<string, QueryValue> = {
          bar_id: barId,
          upcoming: true,
          limit: PAGE_SIZE,
          page: pageToLoad,
        };
        const query = buildQueryString(queryParams);
        const response = await fetch(`${normalizedBaseUrl}/events/instances?${query}`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = await response.json();
        const incoming = extractEventItems(payload).map(mapToEventInstance);
        setEvents((prev) => (mode === 'paginate' ? mergeEvents(prev, incoming) : incoming));
        setPage(pageToLoad);
        setHasMore(shouldKeepPaginating(payload, incoming.length));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load events right now.');
      } finally {
        if (mode === 'paginate') {
          setIsPaginating(false);
        } else if (mode === 'refresh') {
          setIsRefreshing(false);
        } else {
          setIsInitialLoading(false);
        }
      }
    },
    [barId]
  );

  useEffect(() => {
    setHasMore(true);
    setPage(1);
    fetchEvents(1, 'initial');
  }, [fetchEvents]);

  const handleRefresh = useCallback(() => {
    if (isInitialLoading || isRefreshing) {
      return;
    }
    fetchEvents(1, 'refresh');
  }, [fetchEvents, isInitialLoading, isRefreshing]);

  const handleEndReached = useCallback(() => {
    if (isInitialLoading || isPaginating || !hasMore) {
      return;
    }
    fetchEvents(page + 1, 'paginate');
  }, [fetchEvents, hasMore, isInitialLoading, isPaginating, page]);

  const handleRetry = useCallback(() => {
    fetchEvents(1, events.length ? 'refresh' : 'initial');
  }, [events.length, fetchEvents]);

  const handleOpenEvent = useCallback(
    (event: EventInstance) => {
      router.push({ pathname: '/event/[instanceId]', params: { instanceId: event.instanceId } });
    },
    [router]
  );

  const renderItem = useCallback<ListRenderItem<EventInstance>>(
    ({ item }) => <EventCard event={item} tokens={tokens} onPress={() => handleOpenEvent(item)} />,
    [handleOpenEvent, tokens]
  );

  const navTitle = useMemo(() => {
    const introLabel = 'Upcoming events for';
    const barLabel = barName ?? 'This bar';
    return (
      <View style={styles.navTitleContainer}>
        <Text style={[styles.navTitleEyebrow, { color: tokens.subheadingText }]}>{introLabel}</Text>
        <Text style={[styles.navTitleMain, { color: tokens.headingText }]}>{barLabel}</Text>
      </View>
    );
  }, [barName, tokens]);

  const renderEmpty = useMemo(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={tokens.indicator} size="large" />
          <Text style={[styles.emptyStateText, { color: tokens.subheadingText }]}>Loading events...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: tokens.headingText }]}>Unable to load events</Text>
          <Text style={[styles.emptyStateText, { color: tokens.subheadingText }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyStateTitle, { color: tokens.headingText }]}>No upcoming events yet</Text>
        <Text style={[styles.emptyStateText, { color: tokens.subheadingText }]}>Check back later.</Text>
      </View>
    );
  }, [error, handleRetry, isInitialLoading, tokens]);

  const renderFooter = useMemo(() => {
    if (isPaginating) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator color={tokens.indicator} />
        </View>
      );
    }
    if (!hasMore && events.length > 0) {
      return (
        <View style={styles.listFooter}>
          <Text style={[styles.footerText, { color: tokens.footerText }]}>You have reached the end.</Text>
        </View>
      );
    }
    return null;
  }, [events.length, hasMore, isPaginating, tokens]);

  return (
    <View style={[styles.container, { backgroundColor: tokens.pageBackground }]}>
      <Stack.Screen
        options={{
          headerTintColor: tokens.headingText,
          headerTitleAlign: 'left',
          headerStyle: { backgroundColor: tokens.headerBackground },
          headerShadowVisible: true,
          headerTitle: () => navTitle,
        }}
      />
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={events.length === 0 ? styles.listContentEmpty : styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.indicator}
            colors={[tokens.indicator]}
            progressBackgroundColor={tokens.headerBackground}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navTitleContainer: {
    flexDirection: 'column',
  },
  navTitleEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  navTitleMain: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    minHeight: 220,
  },
  cardBody: {
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  tagPill: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
    marginLeft: -8,
    marginTop: -8,
  },
  tagLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  dateText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  timeColumn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  timeColumnDivider: {
    borderLeftWidth: 1,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 15,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  listFooter: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    color: '#6b7280',
  },
});
