// Import react and necessary components/hooks
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type ListRenderItem,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { Bar } from '../../types/index';

// Utils
import { INFINITE_SCROLL_CONFIG } from '../../utils/constants';

// Custom hooks
import { useLocationCache } from '../../hooks/UseLocationCache';
import { useBars } from '../../hooks/useBars';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { useTagFilters } from '../../hooks/useTagFilters';

// Components
import { BarCard } from '../../components/barCard';
import { TagFilterSheet } from '../../components/barTagFilterSheet';
import { BarsListHeader } from '../../components/barsListHeader';
import {
  BarsEmptyState,
  FilteredEmptyState,
} from '../../components/barEmptyStates';


// Main screen component
export default function BarsScreen() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  const router = useRouter();

  // Uses UseLocationCache to manage location state and permissions
  const {
    userCoords,
    locationDeniedPermanently,
    refreshUserLocation,
    getCurrentCoordinates,
  } = useLocationCache();

    // Tag filter state (shared between UI and backend fetches)
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

    // Bars data with pagination
    const {
      bars,
      isLoading,
      isLoadingMore,
      isRefreshing,
      error,
      loadInitial,
      handleRefresh,
      handleRetry,
      handleLoadMore,
    } = useBars(userCoords, selectedTags);

    // Tag filters derived from loaded bars
    // selectedTags and isFilterSheetVisible are passed in and returned unchanged — use local state directly
    const {
      availableTags,
      tagsError,
      retryFetchTags,
      filteredBars,
      selectedTagEntries,
      handleApplyFilters,
      openFilterSheet,
      closeFilterSheet,
      handleClearFilters,
      handleRemoveTag,
    } = useTagFilters(
      bars,
      selectedTags,
      setSelectedTags,
      isFilterSheetVisible,
      setIsFilterSheetVisible
    );

  // Re-fetch bars from the API when tag filters change (server-side filtering)
  const tagsRefreshGuardRef = useRef(false);
  useEffect(() => {
    if (tagsRefreshGuardRef.current) {
      handleRefresh();
      return;
    }
    tagsRefreshGuardRef.current = true;
  }, [selectedTags, handleRefresh]);

  // Scroll position restoration
  const { listRef, handleScroll } = useScrollRestoration<Bar>(bars.length);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const kickoff = async () => {
      const coords = await getCurrentCoordinates();
      
      if (!cancelled) {
        loadInitial(coords);
      }
    };

    kickoff();

    return () => {
      cancelled = true;
    };
  }, [getCurrentCoordinates, loadInitial]);

  // Warm the location cache each time this tab comes into focus.
  // The result is intentionally discarded — this is a background side-effect so that
  // the next pull-to-refresh has a fresh coord ready immediately instead of waiting on GPS.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await getCurrentCoordinates();
      })();
      return () => {
        cancelled = true;
      };
    }, [getCurrentCoordinates])
  );

  // Handlers
  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch((err) => {
      console.warn('Unable to open app settings.', err);
    });
  }, []);

  const openBarDetail = useCallback(
    (barId: string) => {
      router.push({ pathname: '/bar/[barId]', params: { barId } });
    },
    [router]
  );

  const renderItem = useCallback<ListRenderItem<Bar>>(
    ({ item }) => <BarCard bar={item} onPress={() => openBarDetail(item.id)} />,
    [openBarDetail]
  );

  const keyExtractor = useCallback((item: Bar) => item.id, []);

  const errorMessage = error?.message ?? null;


  // Footer component
  const footerComponent = useMemo(() => (
    filteredBars.length > 0 ? (
      isLoadingMore ? (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={palette.text} />
          <Text style={[styles.footerLoadingText, { color: palette.text }]}>
            Loading more bars...
          </Text>
        </View>
      ) : null
    ) : null
  ), [filteredBars, isLoadingMore, palette.text]);

  // Empty component
  const listEmptyComponent = useMemo(() => (
    !isLoading && !isRefreshing && !errorMessage ? (
      filteredBars.length === 0 && selectedTags.length > 0 ? (
        <FilteredEmptyState
          selectedTagEntries={selectedTagEntries}
          onClear={handleClearFilters}
          theme={theme}
        />
      ) : bars.length === 0 ? (
        <BarsEmptyState theme={theme} />
      ) : null
    ) : null
  ), [
    isLoading,
    isRefreshing,
    errorMessage,
    filteredBars.length,
    selectedTags.length,
    selectedTagEntries,
    handleClearFilters,
    bars.length,
    theme,
  ]);

  // Loading state
  if (isLoading && bars.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={palette.text} />
          <Text style={[styles.statusText, { color: palette.text }]}>
            Loading nearby bars...
          </Text>
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
        ListHeaderComponent={
          <BarsListHeader
            locationDeniedPermanently={locationDeniedPermanently}
            availableTags={availableTags}
            selectedTags={selectedTags}
            selectedTagEntries={selectedTagEntries}
            tagsError={tagsError}
            barsCount={bars.length}
            errorMessage={errorMessage}
            theme={theme}
            onOpenSettings={handleOpenSettings}
            onRetryLocation={refreshUserLocation}
            onRetryTags={retryFetchTags}
            onRetry={handleRetry}
            onOpenFilterSheet={openFilterSheet}
            onClearFilters={handleClearFilters}
            onRemoveTag={handleRemoveTag}
          />
        }
        ListFooterComponent={footerComponent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.text}
          />
        }
        onEndReached={handleLoadMore}
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
  footerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerLoadingText: {
    fontSize: 14,
  },
});