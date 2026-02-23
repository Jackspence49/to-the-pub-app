import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

import EventCard from '@/components/eventCard';
import { Colors } from '@/constants/theme';
import type { Event, EventTag } from '@/types/index';

type FetchMode = 'initial' | 'refresh' | 'paginate';
type QueryValue = string | number | boolean | undefined;
type LooseObject = Record<string, any>;

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');
const PAGE_SIZE = 6;


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

const startOfDay = (input: Date) => {
  const copy = new Date(input);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatRelativeEventDay = (value?: string): string => {
  if (!value) {
    return 'Date coming soon';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date coming soon';
  }

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays > 1 && diffDays <= 6) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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

const mergeEvents = (current: Event[], incoming: Event[]): Event[] => {
  if (current.length === 0) {
    return incoming;
  }
  const next = [...current];
  incoming.forEach((event) => {
    const index = next.findIndex((item) => item.instance_id === event.instance_id);
    if (index === -1) {
      next.push(event);
    } else {
      next[index] = event;
    }
  });
  return next;
};

const mapToEventInstance = (raw: LooseObject): Event => {
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
  const derivedVenueName =
    raw.venue?.name ??
    raw.venue_name ??
    raw.location_name ??
    (typeof raw.venue === 'string' ? raw.venue : undefined);
  const barName = raw.bar?.name ?? raw.bar_name ?? derivedVenueName ?? 'Unknown bar';
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
    instance_id: String(primaryId),
    event_id: eventIdSource ? String(eventIdSource) : undefined,
    title: raw.title ?? raw.name ?? 'Untitled event',
    description: raw.description ?? raw.summary ?? raw.subtitle ?? undefined,
    bar_name: barName,
    event_tag_name: eventTagName ?? raw.event_tag_name,
    date: eventDate,
    start_time: startDateTime ?? raw.begin_at ?? undefined,
    end_time: endDateTime ?? undefined,
  };
};

export default function BarEventsScreen() {
  const { barId, barName } = useLocalSearchParams<{ barId?: string; barName?: string }>();
  const router = useRouter();
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];

  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTags = useMemo<EventTag[]>(() => {
    const map = new Map<string, EventTag>();
    events.forEach((event) => {
      const entries = [...(event.event_tag_id ?? []), event.event_tag_name].filter(Boolean) as string[];
      entries.forEach((entry) => {
        const id = entry.trim();
        if (!id || map.has(id)) {
          return;
        }
        map.set(id, { id, name: id });
      });
    });
    return Array.from(map.values());
  }, [events]);

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
    (event: Event) => {
      router.push({ pathname: '/event/[instanceId]', params: { instanceId: event.instance_id } });
    },
    [router]
  );

  const renderItem = useCallback<ListRenderItem<Event>>(
    ({ item }) => (
      <EventCard
        event={item}
        availableTags={availableTags}
        distanceUnit="miles"
        onPress={() => handleOpenEvent(item)}
      />
    ),
    [availableTags, handleOpenEvent]
  );

  const sections = useMemo(() => {
    if (events.length === 0) {
      return [] as { title: string; data: Event[] }[];
    }

    const sorted = [...events].sort((a, b) => {
      const aDate = a.date ?? a.start_time ?? '';
      const bDate = b.date ?? b.start_time ?? '';
      const aTime = new Date(aDate).getTime();
      const bTime = new Date(bDate).getTime();
      const aValue = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
      const bValue = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
      return aValue - bValue;
    });

    const groups: Record<string, { title: string; data: Event[]; order: number }> = {};

    sorted.forEach((event) => {
      const dateValue = event.date ?? event.start_time;
      const normalized = normalizeDateOnly(dateValue ?? undefined) ?? 'unknown-date';
      const label = dateValue ? formatRelativeEventDay(dateValue) : 'Date coming soon';
      const orderValue = (() => {
        const ts = dateValue ? new Date(dateValue).getTime() : Number.MAX_SAFE_INTEGER;
        return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
      })();

      if (!groups[normalized]) {
        groups[normalized] = { title: label, data: [], order: orderValue };
      }

      groups[normalized].data.push(event);
    });

    return Object.values(groups)
      .sort((a, b) => a.order - b.order)
      .map(({ title, data }) => ({ title, data }));
  }, [events]);

  const navTitle = useMemo(() => {
    const introLabel = 'Upcoming events for';
    const barLabel = barName ?? 'This bar';
    return (
      <View style={styles.navTitleContainer}>
        <Text style={[styles.navTitleEyebrow, { color: palette.cardSubtitle }]}>{introLabel}</Text>
        <Text style={[styles.navTitleMain, { color: palette.cardTitle }]}>{barLabel}</Text>
      </View>
    );
  }, [barName, palette]);

  const renderEmpty = useMemo(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={palette.cardText} size="large" />
          <Text style={[styles.emptyStateText, { color: palette.cardSubtitle }]}>Loading events...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: palette.cardTitle }]}>Unable to load events</Text>
          <Text style={[styles.emptyStateText, { color: palette.cardSubtitle }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyStateTitle, { color: palette.cardTitle }]}>No upcoming events yet</Text>
        <Text style={[styles.emptyStateText, { color: palette.cardSubtitle }]}>Check back later.</Text>
      </View>
    );
  }, [error, handleRetry, isInitialLoading, palette]);

  const renderFooter = useMemo(() => {
    if (isPaginating) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator color={palette.cardText} />
        </View>
      );
    }
    if (!hasMore && events.length > 0) {
      return (
        <View style={styles.listFooter}>
          <Text style={[styles.container, { color: palette.cardSubtitle }]}>You have reached the end.</Text>
        </View>
      );
    }
    return null;
  }, [events.length, hasMore, isPaginating, palette]);

  return (
    <View style={[styles.container, { backgroundColor: palette.container }]}>
      <Stack.Screen
        options={{
          headerTintColor: palette.cardTitle,
          headerTitleAlign: 'left',
          headerStyle: { backgroundColor: palette.container },
          headerShadowVisible: true,
          headerTitle: () => navTitle,
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.instance_id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: palette.background }]}>
            <View
              style={[
                styles.sectionHeaderPill,
                { backgroundColor: palette.background, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.cardTitle }]}>
                {section.title}
              </Text>
            </View>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={
          sections.length === 0 ? styles.listContentEmpty : styles.listContent
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.cardText}
            colors={[palette.cardText]}
            progressBackgroundColor={palette.container}
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeaderPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  },
  cardBody: {
    padding: 18,
  },
  primaryTagLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  eventBarName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  metaDistanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  eventMeta: {
    fontSize: 15,
    fontWeight: '600',
  },
  scheduleBlock: {
    marginTop: 16,
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  timeColumn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timeColumnRight: {
    borderLeftWidth: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    marginTop: 6,
    fontSize: 16,
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
  footerText : {
    fontSize: 13,
    fontWeight: '600',
  },
  listFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});