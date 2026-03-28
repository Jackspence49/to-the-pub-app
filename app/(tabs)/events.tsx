import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	View,
	useColorScheme,
	type ListRenderItem,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { Event, EventListRow } from '../../types/index';

// Utils
import { formatRelativeEventDay, normalizeDateOnly, parseTagParam } from '../../utils/Eventmappers';
import { DEFAULT_EVENT_RADIUS_MILES, DISTANCE_UNIT, INFINITE_SCROLL_CONFIG } from '../../utils/constants';

// Custom hooks
import { useLocationCache } from '../../hooks/UseLocationCache';
import { useEventTagFilters } from '../../hooks/useEventTagFilters';
import { useEvents } from '../../hooks/useEvents';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';

// Components
import EventCard from '../../components/eventCard';
import { EventTagFilterSheet } from '../../components/eventTagFilterSheet';
import { EventsListHeader } from '../../components/eventsListHeader';

export default function EventsScreen() {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const router = useRouter();
	const searchParams = useLocalSearchParams<{ eventTagId?: string | string[] }>();
	const initialSelectedTagIds = useMemo(
		() => parseTagParam(searchParams.eventTagId),
		[searchParams.eventTagId]
	);

	const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_EVENT_RADIUS_MILES);
	const { userCoords, refreshUserLocation } = useLocationCache();
	const {
		selectedTagIds,
		availableTags,
		areTagsLoading,
		tagsError,
		isFilterSheetVisible,
		selectedTagNames,
		fetchAvailableTags,
		handleApplyFilters,
		handleClearTags,
		openFilterSheet,
		closeFilterSheet,
	} = useEventTagFilters(initialSelectedTagIds);
	const {
		events,
		isInitialLoading,
		isRefreshing,
		isPaginating,
		hasMore,
		error,
		handleRefresh,
		handleEndReached,
		handleRetry,
	} = useEvents(userCoords, selectedTagIds, searchRadius);
	const { listRef, handleScroll } = useScrollRestoration<EventListRow>(events.length);

	const handleOpenEvent = useCallback(
		(event: Event) => {
			const instanceId = event.instance_id;
			if (!instanceId) return;
			router.push({ pathname: '/event/[instanceId]', params: { instanceId } });
		},
		[router]
	);

	const handleRadiusChange = useCallback((nextRadius: number) => {
		setSearchRadius(Math.max(1, nextRadius));
	}, []);

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

	const renderItem = useCallback<ListRenderItem<EventListRow>>(
		({ item }) => {
			if (item.type === 'date') {
				return (
					<View style={[styles.dateSeparatorPill, { backgroundColor: palette.container, borderColor: palette.border }]}>
						<Text style={[styles.dateSeparatorText, { color: palette.cardTitle }]}>{item.label}</Text>
					</View>
				);
			}
			return (
				<EventCard
					event={item.event}
					distanceUnit={DISTANCE_UNIT}
					onPress={() => handleOpenEvent(item.event)}
				/>
			);
		},
		[handleOpenEvent, palette]
	);

	const flatEvents = useMemo(() => {
		if (events.length === 0) return [] as Event[];
		return [...events].sort((a, b) => {
			const aDate = a.date ?? a.start_time ?? '';
			const bDate = b.date ?? b.start_time ?? '';
			const aTime = new Date(aDate).getTime();
			const bTime = new Date(bDate).getTime();
			const aValue = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
			const bValue = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
			return aValue - bValue;
		});
	}, [events]);

	const listRows = useMemo<EventListRow[]>(() => {
		if (flatEvents.length === 0) return [];
		const rows: EventListRow[] = [];
		let lastLabel: string | null = null;
		flatEvents.forEach((event) => {
			const dateValue = event.date ?? event.start_time;
			const normalized = normalizeDateOnly(dateValue ?? undefined) ?? 'unknown-date';
			const label = dateValue ? formatRelativeEventDay(dateValue) : 'Date coming soon';
			if (label !== lastLabel) {
				rows.push({ type: 'date', key: `date-${normalized}-${label}`, label });
				lastLabel = label;
			}
			rows.push({ type: 'event', key: `event-${event.instance_id}`, event });
		});
		return rows;
	}, [flatEvents]);

	const ListHeader = useCallback(() => (
		<EventsListHeader
			theme={theme}
			selectedTagIds={selectedTagIds}
			selectedTagNames={selectedTagNames}
			searchRadius={searchRadius}
			areTagsLoading={areTagsLoading}
			tagsError={tagsError}
			error={error}
			onOpenFilterSheet={openFilterSheet}
			onClearTags={handleClearTags}
			onRadiusChange={handleRadiusChange}
			onRetryTags={fetchAvailableTags}
			onRetryEvents={handleRetry}
		/>
	), [
		theme,
		selectedTagIds,
		selectedTagNames,
		searchRadius,
		areTagsLoading,
		tagsError,
		error,
		openFilterSheet,
		handleClearTags,
		handleRadiusChange,
		fetchAvailableTags,
		handleRetry,
	]);

	const listEmptyComponent = useMemo(() => {
		if (error) return null;
		return (
			<View style={styles.emptyState}>
				<Text style={[styles.emptyStateTitle, { color: palette.filterText }]}>Nothing scheduled yet</Text>
				<Text style={[styles.emptyStateText, { color: palette.filterText }]}>
					We could not find upcoming events for the selected tags.
				</Text>
			</View>
		);
	}, [error, palette]);

	const listFooterComponent = useMemo(() => {
		if (isPaginating) {
			return (
				<View style={styles.listFooter}>
					<ActivityIndicator color={palette.filterActivePill} />
				</View>
			);
		}
		if (!hasMore && events.length > 0) {
			return (
				<View style={styles.listFooter}>
					<Text style={[styles.footerText, { color: palette.filterActivePill }]}>You have reached the end.</Text>
				</View>
			);
		}
		return null;
	}, [events.length, hasMore, isPaginating, palette]);

	if (isInitialLoading && events.length === 0) {
		return (
			<View style={[styles.container, { backgroundColor: palette.background }]}>
				<View style={styles.centerContent}>
					<ActivityIndicator size="large" color={palette.actionButton} />
					<Text style={[styles.statusText, { color: palette.cardTitle }]}>Loading events...</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}>
			<FlatList
				ref={listRef}
				style={[styles.list, { backgroundColor: palette.background }]}
				data={listRows}
				keyExtractor={(item) => item.key}
				renderItem={renderItem}
				ListHeaderComponent={ListHeader}
				contentContainerStyle={listRows.length === 0 ? styles.listContentEmpty : styles.listContent}
				ListEmptyComponent={listEmptyComponent}
				ListFooterComponent={listFooterComponent}
				onEndReached={handleEndReached}
				onEndReachedThreshold={INFINITE_SCROLL_CONFIG.loadMoreThreshold}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={palette.filterActivePill}
						colors={[palette.filterActivePill]}
						progressBackgroundColor={palette.container}
					/>
				}
				initialNumToRender={INFINITE_SCROLL_CONFIG.initialPageSize}
				maxToRenderPerBatch={INFINITE_SCROLL_CONFIG.subsequentPageSize}
				windowSize={5}
				removeClippedSubviews
				onScroll={handleScroll}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
			/>
			<EventTagFilterSheet
				visible={isFilterSheetVisible}
				tags={availableTags}
				selectedTagIds={selectedTagIds}
				onApply={handleApplyFilters}
				onClose={closeFilterSheet}
				onRetry={fetchAvailableTags}
				isLoading={areTagsLoading}
				error={tagsError}
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
		paddingBottom: 32,
	},
	listContentEmpty: {
		flexGrow: 1,
		paddingBottom: 32,
	},
	dateSeparatorPill: {
		alignSelf: 'flex-start',
		marginHorizontal: 20,
		marginTop: 12,
		marginBottom: 6,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
	},
	dateSeparatorText: {
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.3,
		textTransform: 'uppercase',
	},
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32,
		gap: 8,
	},
	emptyStateTitle: {
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
	},
	emptyStateText: {
		fontSize: 14,
		textAlign: 'center',
	},
	listFooter: {
		padding: 20,
		alignItems: 'center',
	},
	footerText: {
		fontSize: 13,
		fontWeight: '500',
	},
});
