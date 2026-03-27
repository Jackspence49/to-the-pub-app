// hooks/useEvents.ts
// Custom hook for fetching and managing events data with pagination and caching

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordinates, Event, EventsCache, QueryParams } from '../types/index';
import { DEFAULT_COORDS, INFINITE_SCROLL_CONFIG } from '../utils/constants';
import { buildQueryString, getCacheKey } from '../utils/helpers';
import { extractEventItems, mapToEvent, mergeEvents } from '../utils/Eventmappers';
import { PayloadWithPagination, shouldContinuePagination } from '../utils/pagination';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PAGE_SIZE = INFINITE_SCROLL_CONFIG.initialPageSize;
const DISTANCE_UNIT = 'miles';
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

type FetchMode = 'initial' | 'refresh' | 'paginate';

export const useEvents = (
  userCoords: Coordinates | null,
  selectedTagIds: string[],
  searchRadius: number
) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const cacheRef = useRef<EventsCache | null>(null);

  const fetchEvents = useCallback(
    async (pageToLoad: number, mode: FetchMode) => {
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;

      setIsPaginating(mode === 'paginate');
      setIsRefreshing(mode === 'refresh');
      setIsInitialLoading(mode === 'initial');
      // Clear stale results immediately on initial so the list doesn't flash old data
      if (mode === 'initial') {
        setEvents([]);
      }

      if (!API_BASE_URL) {
        setError('Set EXPO_PUBLIC_API_URL in your .env file to load events.');
        setIsPaginating(false);
        setIsRefreshing(false);
        setIsInitialLoading(false);
        return;
      }

      try {
        setError(null);
        const coordsToUse = userCoords ?? DEFAULT_COORDS;
        const cacheKey = getCacheKey(coordsToUse, selectedTagIds, searchRadius);

        if (mode !== 'paginate' && cacheRef.current) {
          const cached = cacheRef.current;
          const isCacheValid =
            cached.key === cacheKey &&
            Date.now() - cached.timestamp < INFINITE_SCROLL_CONFIG.cacheTimeout;

          if (isCacheValid) {
            setEvents(cached.data);
            setPage(cached.currentPage);
            setHasMore(cached.hasMore);
            setIsInitialLoading(false);
            setIsRefreshing(false);
            setIsPaginating(false);
            return;
          }
        }

        const queryParams: QueryParams = {
          upcoming: 'true',
          limit: PAGE_SIZE,
          page: pageToLoad,
          lat: coordsToUse.lat,
          lon: coordsToUse.lon,
          radius: searchRadius,
          unit: DISTANCE_UNIT,
        };

        if (selectedTagIds.length > 0) {
          queryParams.event_tag_id = selectedTagIds[0];
        }

        const query = buildQueryString(queryParams);
        const response = await fetch(`${normalizedBaseUrl}/events/instances?${query}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload: PayloadWithPagination = await response.json();
        const incoming = extractEventItems(payload).map(mapToEvent);
        const pageMeta = payload.meta?.pagination;
        const hasMoreNext = shouldContinuePagination(payload, incoming.length, PAGE_SIZE);
        const resolvedPage =
          typeof pageMeta?.current_page === 'number' ? pageMeta.current_page : pageToLoad;

        if (requestSeqRef.current !== requestId) return;

        setEvents((prev) => (mode === 'paginate' ? mergeEvents(prev, incoming) : incoming));
        setPage(resolvedPage);
        setHasMore(hasMoreNext);

        cacheRef.current = {
          key: cacheKey,
          timestamp: Date.now(),
          data: mode === 'paginate'
            ? mergeEvents(cacheRef.current?.data ?? [], incoming)
            : incoming,
          currentPage: resolvedPage,
          hasMore: hasMoreNext,
        };
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (requestSeqRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'Unable to load events right now.');
      } finally {
        if (requestSeqRef.current !== requestId) return;
        requestAbortRef.current = null;
        setIsPaginating(false);
        setIsRefreshing(false);
        setIsInitialLoading(false);
      }
    },
    [searchRadius, selectedTagIds, userCoords]
  );

  // Re-fetch whenever fetchEvents identity changes (i.e. coords, tags, or radius changed)
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchEvents(1, 'initial');
  }, [fetchEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    if (isInitialLoading || isRefreshing) return;
    fetchEvents(1, 'refresh');
  }, [fetchEvents, isInitialLoading, isRefreshing]);

  const handleEndReached = useCallback(() => {
    if (isInitialLoading || isPaginating || !hasMore) return;
    fetchEvents(page + 1, 'paginate');
  }, [fetchEvents, hasMore, isInitialLoading, isPaginating, page]);

  const handleRetry = useCallback(() => {
    fetchEvents(1, events.length ? 'refresh' : 'initial');
  }, [events.length, fetchEvents]);

  return {
    events,
    isInitialLoading,
    isRefreshing,
    isPaginating,
    hasMore,
    error,
    handleRefresh,
    handleEndReached,
    handleRetry,
  };
};
