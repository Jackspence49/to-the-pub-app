import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	useColorScheme,
	type ListRenderItem,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { Event, EventListRow } from '../../types/index';

// Utils
import {
	extractEventItems,
	formatRelativeEventDay,
	mapToEvent,
	mergeEvents,
	normalizeDateOnly,
} from '../../utils/Eventmappers';
import { API_BASE_URL, EVENTS_ENDPOINT, INFINITE_SCROLL_CONFIG } from '../../utils/constants';
import { shouldContinuePagination } from '../../utils/pagination';

// Components
import EventCard from '../../components/eventCard';

type FetchMode = 'initial' | 'refresh' | 'paginate';

const PAGE_SIZE = INFINITE_SCROLL_CONFIG.initialPageSize;

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

	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchEvents = useCallback(
		async (pageToLoad: number, mode: FetchMode) => {
			abortControllerRef.current?.abort();
			const controller = new AbortController();
			abortControllerRef.current = controller;
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
				const params = new URLSearchParams({
					bar_id: barId,
					upcoming: 'true',
					limit: String(PAGE_SIZE),
					page: String(pageToLoad),
				});
				const response = await fetch(`${EVENTS_ENDPOINT}/instances?${params.toString()}`, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Request failed with status ${response.status}`);
				}
				const payload = await response.json();
				const incoming = extractEventItems(payload).map(mapToEvent);
				setEvents((prev) => (mode === 'paginate' ? mergeEvents(prev, incoming) : incoming));
				setPage(pageToLoad);
				setHasMore(shouldContinuePagination(payload, incoming.length, PAGE_SIZE));
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return;
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
		return () => { abortControllerRef.current?.abort(); };
	}, [fetchEvents]);

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

	const handleOpenEvent = useCallback(
		(event: Event) => {
			router.push({ pathname: '/event/[instanceId]', params: { instanceId: event.instance_id } });
		},
		[router]
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
					distanceUnit="miles"
					onPress={() => handleOpenEvent(item.event)}
				/>
			);
		},
		[handleOpenEvent, palette]
	);

	const navTitle = useMemo(
		() => (
			<View style={styles.navTitleContainer}>
				<Text style={[styles.navTitleEyebrow, { color: palette.cardSubtitle }]}>Upcoming events for</Text>
				<Text style={[styles.navTitleMain, { color: palette.cardTitle }]}>{barName ?? 'This bar'}</Text>
			</View>
		),
		[barName, palette]
	);

	const listEmptyComponent = useMemo(() => {
		if (error) {
			return (
				<View style={styles.emptyState}>
					<Text style={[styles.emptyStateTitle, { color: palette.cardTitle }]}>Unable to load events</Text>
					<Text style={[styles.emptyStateText, { color: palette.cardSubtitle }]}>{error}</Text>
					<TouchableOpacity style={[styles.retryButton, { borderColor: palette.actionButton }]} onPress={handleRetry}>
						<Text style={[styles.retryButtonText, { color: palette.actionButton }]}>Try again</Text>
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
	}, [error, handleRetry, palette]);

	const listFooterComponent = useMemo(() => {
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
					<Text style={[styles.footerText, { color: palette.cardSubtitle }]}>You have reached the end.</Text>
				</View>
			);
		}
		return null;
	}, [events.length, hasMore, isPaginating, palette]);

	if (isInitialLoading && events.length === 0) {
		return (
			<View style={[styles.container, { backgroundColor: palette.background }]}>
				<Stack.Screen
					options={{
						headerTintColor: palette.cardTitle,
						headerTitleAlign: 'left',
						headerStyle: { backgroundColor: palette.container },
						headerShadowVisible: true,
						headerTitle: () => navTitle,
					}}
				/>
				<View style={styles.centerContent}>
					<ActivityIndicator size="large" color={palette.actionButton} />
					<Text style={[styles.statusText, { color: palette.cardTitle }]}>Loading events...</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}>
			<Stack.Screen
				options={{
					headerTintColor: palette.cardTitle,
					headerTitleAlign: 'left',
					headerStyle: { backgroundColor: palette.container },
					headerShadowVisible: true,
					headerTitle: () => navTitle,
				}}
			/>
			<FlatList
				style={[styles.list, { backgroundColor: palette.background }]}
				data={listRows}
				keyExtractor={(item) => item.key}
				renderItem={renderItem}
				contentContainerStyle={listRows.length === 0 ? styles.listContentEmpty : styles.listContent}
				ListEmptyComponent={listEmptyComponent}
				ListFooterComponent={listFooterComponent}
				onEndReached={handleEndReached}
				onEndReachedThreshold={INFINITE_SCROLL_CONFIG.loadMoreThreshold}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={palette.cardText}
						colors={[palette.cardText]}
						progressBackgroundColor={palette.container}
					/>
				}
				initialNumToRender={INFINITE_SCROLL_CONFIG.initialPageSize}
				maxToRenderPerBatch={INFINITE_SCROLL_CONFIG.subsequentPageSize}
				windowSize={5}
				removeClippedSubviews
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
	dateSeparatorPill: {
		alignSelf: 'flex-start',
		marginHorizontal: 20,
		marginTop: 20,
		marginBottom: 0,
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
	},
	dateSeparatorText: {
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
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32,
		gap: 12,
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
	retryButton: {
		marginTop: 8,
		borderRadius: 999,
		borderWidth: 2,
		paddingHorizontal: 24,
		paddingVertical: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	retryButtonText: {
		fontSize: 15,
		fontWeight: '700',
		textTransform: 'uppercase',
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
