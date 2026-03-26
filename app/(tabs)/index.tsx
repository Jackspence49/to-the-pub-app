// Import react and necessary components/hooks
import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  type ListRenderItem,
} from 'react-native';

// Types
import type { Bar } from '../../types/index';

// Utils
import { INFINITE_SCROLL_CONFIG } from '../../utils/constants';

// Custom hooks
import { useLocationCache } from '../../hooks/UseLocationCache';
import { useBars } from '../../hooks/useBars';
import { useTagFilters } from '../../hooks/useTagFilters';

// Components
import { BarCard } from '../../components/barCard';
import {
  BarsEmptyState,
  ErrorBanner,
  FilteredEmptyState,
  LocationPermissionBanner,
} from '../../components/emptyStates';
import { TagFilterSheet } from '../../components/tagFilterSheet';


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
      loadBarsPage,
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

  // Refs for scroll position restoration
  const listRef = useRef<FlatList<Bar>>(null);
  const lastScrollOffsetRef = useRef(0);
  const restorePendingRef = useRef(false);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    const offset = Math.max(0, lastScrollOffsetRef.current);
    if (listRef.current && offset > 0) {
      listRef.current.scrollToOffset({ offset, animated: false });
    }
  }, []);

  // Focus effect for scroll restoration
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

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const kickoff = async () => {
      const coords = await getCurrentCoordinates();
      
      if (!cancelled) {
        loadBarsPage(1, 'initial', { coordsOverride: coords });
      }
    };

    kickoff();

    return () => {
      cancelled = true;
    };
  }, [getCurrentCoordinates, loadBarsPage]);

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

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

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

  // Header component
  const headerComponent = useMemo(() => (
    locationDeniedPermanently ||
    availableTags.length > 0 ||
    selectedTags.length > 0 ||
    !!tagsError ||
    (bars.length > 0 && errorMessage) ? (
      <View style={styles.listHeader}>
        <Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Open Bars</Text>
        
        {locationDeniedPermanently ? (
          <LocationPermissionBanner
            theme={theme}
            onOpenSettings={handleOpenSettings}
            onRetry={refreshUserLocation}
          />
        ) : null}

        {tagsError ? (
          <TouchableOpacity onPress={retryFetchTags} activeOpacity={0.7}>
            <Text style={[styles.tagsErrorText, { color: palette.warningText }]}>
              Unable to load filters — tap to retry
            </Text>
          </TouchableOpacity>
        ) : null}

        {availableTags.length > 0 || selectedTags.length > 0 ? (
          <View style={[styles.filterCard, { backgroundColor: palette.background }]}>
            <View style={styles.filterButtonRow}>
              <TouchableOpacity
                onPress={openFilterSheet}
                style={[
                  styles.filterButton,
                  styles.filterButtonLarge,
                  { backgroundColor: palette.actionButton },
                ]}
                activeOpacity={0.9}
              >
                <MaterialIcons
                  name="tune"
                  size={18}
                  color={palette.filterTextActive}
                  style={styles.filterButtonIcon}
                />
                <Text style={[styles.filterButtonText, { color: palette.filterTextActive }]}>
                  Filters
                  {selectedTags.length
                    ? ` (${selectedTags.length})`
                    : ''}
                </Text>
              </TouchableOpacity>
              {selectedTags.length ? (
                <TouchableOpacity
                  onPress={handleClearFilters}
                  style={[styles.inlineClearButton, { borderColor: palette.filterActivePill }]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.inlineClearText, { color: palette.filterActivePill }]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {selectedTagEntries.length ? (
              <View style={styles.selectedTagChipRow}>
                {selectedTagEntries.map((entry) => (
                  <View
                    key={entry.normalized}
                    style={[
                      styles.selectedTagChip,
                      { borderColor: palette.border, backgroundColor: palette.filterContainer },
                    ]}
                  >
                    <Text
                      style={[styles.selectedTagChipLabel, { color: palette.pillText }]}
                      numberOfLines={1}
                    >
                      {entry.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveTag(entry.normalized)}
                      style={[
                        styles.selectedTagChipClose,
                        { backgroundColor: palette.filterContainer },
                      ]}
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

        {bars.length > 0 && errorMessage ? (
          <ErrorBanner message={errorMessage} theme={theme} />
        ) : null}
      </View>
    ) : null
  ), [
    locationDeniedPermanently,
    availableTags.length,
    selectedTags,
    selectedTagEntries,
    tagsError,
    openFilterSheet,
    retryFetchTags,
    handleClearFilters,
    handleRemoveTag,
    bars.length,
    errorMessage,
    palette,
    theme,
    handleOpenSettings,
    refreshUserLocation,
  ]);

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
    !isLoading && !isRefreshing ? (
      filteredBars.length === 0 && selectedTags.length > 0 ? (
        <FilteredEmptyState
          selectedTagEntries={selectedTagEntries}
          onClear={handleClearFilters}
          theme={theme}
        />
      ) : bars.length === 0 ? (
        <BarsEmptyState error={errorMessage} onRetry={handleRetry} theme={theme} />
      ) : null
    ) : null
  ), [
    isLoading,
    isRefreshing,
    filteredBars.length,
    selectedTags.length,
    selectedTagEntries,
    handleClearFilters,
    bars.length,
    errorMessage,
    handleRetry,
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
        ListHeaderComponent={headerComponent}
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
  footerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerLoadingText: {
    fontSize: 14,
  },
  footerHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  tagsErrorText: {
    fontSize: 14,
    fontWeight: '500',
  },
});