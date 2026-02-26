// hooks/useBars.ts
// Custom hook for fetching and managing bars data with pagination

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BarsCache,
  Coordinates,
  LoadBarsPageOptions,
  LoadMode,
  PaginationState,
  QueryParams
} from '../types';
import {
  mapBarsInBatches,
  mergeBars,
} from '../utils/Barmappers';
import {
  BARS_ENDPOINT,
  DEFAULT_COORDS,
  INDEX_BASE_QUERY_PARAMS,
  INFINITE_SCROLL_CONFIG,
} from '../utils/constants';
import {
  buildQueryString,
  extractBarItems,
  getCacheKey,
} from '../utils/helpers';
import {
  PayloadWithPagination,
  extractTotalCount,
  shouldContinuePagination,
} from '../utils/pagination';


// Custom hook for managing bars data with pagination, caching, and error handling
export const useBars = (
  userCoords: Coordinates | null,
  selectedTags: string[]
) => {
  const [pagination, setPagination] = useState<PaginationState>({
    data: [],
    currentPage: 0,
    isLoading: true,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    totalCount: undefined,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for managing requests and cache
  const inFlightPagesRef = useRef<Set<number>>(new Set());
  const activeRequestCountRef = useRef(0);
  const queuedRequestRef = useRef<{
    page: number;
    mode: LoadMode;
    options?: LoadBarsPageOptions;
  } | null>(null);
  const cacheRef = useRef<BarsCache | null>(null);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const hasMoreRef = useRef(true);

  useEffect(() => {
    hasMoreRef.current = pagination.hasMore;
  }, [pagination.hasMore]);

  /**
   * Get page size based on page number
   */
  const getPageSize = useCallback((page: number) => {
    return page === 1
      ? INFINITE_SCROLL_CONFIG.initialPageSize
      : INFINITE_SCROLL_CONFIG.subsequentPageSize;
  }, []);

  /**
   * Load a specific page of bars
   */
  const loadBarsPage = useCallback(
    async (
      page: number,
      mode: LoadMode = 'initial',
      options: LoadBarsPageOptions = {}
    ) => {
      const { ignoreCache = false, coordsOverride } = options;
      const coordsToUse = coordsOverride ?? userCoords ?? DEFAULT_COORDS;
      const cacheKey = getCacheKey(coordsToUse, selectedTags);

      // Check cache
      if (!ignoreCache && mode !== 'prefetch') {
        const cached = cacheRef.current;
        const isCacheValid =
          cached &&
          cached.key === cacheKey &&
          Date.now() - cached.timestamp < INFINITE_SCROLL_CONFIG.cacheTimeout;

        if (isCacheValid && page <= cached.currentPage) {
          setPagination((prev) => ({
            ...prev,
            data: cached.data,
            currentPage: cached.currentPage,
            hasMore: cached.hasMore,
            totalCount: cached.totalCount,
            isLoading: false,
            isLoadingMore: false,
            error: null,
          }));
          return;
        }
      }

      // Check if already loading this page
      if (inFlightPagesRef.current.has(page)) {
        return;
      }

      // Check concurrent request limit
      if (activeRequestCountRef.current >= INFINITE_SCROLL_CONFIG.maxConcurrentRequests) {
        queuedRequestRef.current = { page, mode, options: { ...options, ignoreCache: true } };
        return;
      }

      inFlightPagesRef.current.add(page);
      activeRequestCountRef.current += 1;

      // Set loading states
      if (mode === 'initial') {
        setPagination((prev) => ({ ...prev, isLoading: true, error: null }));
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
        setPagination((prev) => ({
          ...prev,
          isLoading: false,
          isLoadingMore: false,
          currentPage: 0,
          hasMore: true,
          error: null,
        }));
      } else if (mode === 'load-more' || mode === 'prefetch') {
        setPagination((prev) => ({ ...prev, isLoadingMore: true }));
      }

      const controller = new AbortController();
      abortControllersRef.current.set(page, controller);

      const pageSize = getPageSize(page);
      let nextHasMore: boolean | null = null;

      try {
        const queryParams: QueryParams = {
          ...INDEX_BASE_QUERY_PARAMS,
          lat: coordsToUse.lat,
          lon: coordsToUse.lon,
          page,
          limit: pageSize,
          tags: selectedTags.length ? selectedTags.join(',') : undefined,
        };

        const queryString = buildQueryString(queryParams);
        const requestUrl = queryString ? `${BARS_ENDPOINT}?${queryString}` : BARS_ENDPOINT;
        
        const response = await fetch(requestUrl, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload: PayloadWithPagination = await response.json();
        const rawItems = extractBarItems(payload);
        const startIndex = (page - 1) * pageSize;
        const items = await mapBarsInBatches(rawItems, startIndex);
        
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

        // Prefetch next page
        if (
          INFINITE_SCROLL_CONFIG.prefetchPages > 0 &&
          (mode === 'initial' || mode === 'refresh' || mode === 'load-more')
        ) {
          const prefetchTarget = page + INFINITE_SCROLL_CONFIG.prefetchPages;
          if (nextHasMore && !inFlightPagesRef.current.has(prefetchTarget)) {
            queuedRequestRef.current = null;
            loadBarsPage(prefetchTarget, 'prefetch', {
              ignoreCache: true,
              coordsOverride: coordsToUse,
            });
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        
        const message =
          err instanceof Error ? err.message : 'Something went wrong while loading bars.';
        
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

        // Process queued request
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

  /**
   * Refresh bars (pull-to-refresh)
   */
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

  /**
   * Retry after error
   */
  const handleRetry = useCallback(() => {
    const mode: LoadMode = pagination.data.length ? 'refresh' : 'initial';
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
  }, [pagination.data.length, loadBarsPage]);

  /**
   * Load more bars (infinite scroll)
   */
  const handleLoadMore = useCallback(() => {
    if (pagination.isLoading || pagination.isLoadingMore || !pagination.hasMore) {
      return;
    }
    const nextPage = Math.max(1, pagination.currentPage + 1);
    loadBarsPage(nextPage, 'load-more', { ignoreCache: true });
  }, [pagination.currentPage, pagination.hasMore, pagination.isLoading, pagination.isLoadingMore, loadBarsPage]);

  // Cleanup on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  return {
    bars: pagination.data,
    isLoading: pagination.isLoading,
    isLoadingMore: pagination.isLoadingMore,
    isRefreshing,
    hasMore: pagination.hasMore,
    error: pagination.error,
    totalCount: pagination.totalCount,
    currentPage: pagination.currentPage,
    loadBarsPage,
    handleRefresh,
    handleRetry,
    handleLoadMore,
  };
};