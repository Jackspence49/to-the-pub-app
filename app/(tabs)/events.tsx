import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
// React Native components
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native';

//types
import type { Coordinates, Event, EventsCache, EventTag, QueryParams, ThemeName } from '@/types/index';

// Components
import EventCard from '@/components/eventCard';
import { EventTagFilterSheet } from '@/components/eventTagFilterSheet';

import { DEFAULT_COORDS, EVENT_TAGS_ENDPOINT, INFINITE_SCROLL_CONFIG } from '../../utils/constants';
import { buildQueryString, getCacheKey } from '../../utils/helpers';
import { extractEventItems, extractTagItems, mapToEvent, mapToEventTag, mergeEvents, normalizeDateOnly } from '../../utils/Eventmappers';
import { PayloadWithPagination, shouldContinuePagination } from '../../utils/pagination';

// Default Parameters
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PAGE_SIZE = INFINITE_SCROLL_CONFIG.initialPageSize;
const DEFAULT_RADIUS_MILES = 10;
const DISTANCE_UNIT = 'miles';
const RADIUS_OPTIONS = [1, 3, 5, 10];
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

// Type definitions
type FetchMode = 'initial' | 'refresh' | 'paginate';

// Flat list rows (date separators and events)
type EventListRow =
	| { type: 'date'; key: string; label: string }
	| { type: 'event'; key: string; event: Event };

// Normalize a tag id array to trimmed, unique values
const normalizeTagIds = (ids: string[]): string[] =>
	Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const normalizeTagParamList = (value?: string | string[]): string[] => {
	if (!value) {
		return [];
	}

	const rawList = Array.isArray(value) ? value : value.split(',');
	return rawList
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
};

// Function to get the start of day for a given date
const startOfDay = (input: Date) => {
	const copy = new Date(input);
	copy.setHours(0, 0, 0, 0);
	return copy;
};

// Function to format event day strings relatively
const formatRelativeEventDay = (value?: string): string => {
	if (!value) {
		return 'Date coming soon';
	}

	// Parse date-only strings (YYYY-MM-DD) as local time to avoid UTC midnight off-by-one
	const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
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
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
		}).format(date);
	}

	return new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	}).format(date);
};

type RadiusSelectorProps = {
	value: number;
	onChange: (value: number) => void;
	theme: ThemeName;
};

// Radius selector component
const RadiusSelector = ({ value, onChange, theme }: RadiusSelectorProps) => {
	const [isPickerVisible, setPickerVisible] = useState(false);
	const palette = Colors[theme];

	const handleSelect = useCallback(
		(next: number) => {
			onChange(next);
			setPickerVisible(false);
		},
		[onChange]
	);

	const unitLabel = DISTANCE_UNIT === 'miles' ? 'mi' : DISTANCE_UNIT;
	const currentLabel = `Location: ${value} ${unitLabel}`;
	return (
		<View style={styles.radiusPickerContainer}>
			<TouchableOpacity
				style={[styles.radiusPickerButton, { borderColor: palette.border, backgroundColor: palette.background }]}
				onPress={() => setPickerVisible((prev) => !prev)}
				activeOpacity={0.85}
				accessibilityLabel={`Search radius: ${value} ${unitLabel}. Tap to change.`}
				accessibilityRole="button"
			>
				<Text style={[styles.radiusPickerValue, { color: palette.cardTitle }]}>{currentLabel}</Text>
				<MaterialIcons name={isPickerVisible ? 'arrow-drop-up' : 'arrow-drop-down'} size={22} color={palette.cardTitle} />
			</TouchableOpacity>

			{isPickerVisible ? (
				<View style={[styles.radiusPickerDropdown, { backgroundColor: palette.container, borderColor: palette.border }]}>
					{RADIUS_OPTIONS.map((option) => (
						<TouchableOpacity
							key={option}
							style={styles.radiusPickerOption}
							onPress={() => handleSelect(option)}
							accessibilityLabel={`${option} ${unitLabel}`}
							accessibilityRole="button"
						>
							<Text style={[styles.radiusPickerOptionText, { color: option === value ? palette.cardTitle : palette.cardSubtitle }]}>
								{option} {unitLabel}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			) : null}
		</View>
	);
};

type EventsListHeaderProps = {
	theme: ThemeName;
	selectedTagIds: string[];
	selectedTagNames: string[];
	searchRadius: number;
	areTagsLoading: boolean;
	tagsError: string | null;
	error: string | null;
	onOpenFilterSheet: () => void;
	onClearTags: () => void;
	onRadiusChange: (value: number) => void;
	onRetryTags: () => void;
	onRetryEvents: () => void;
};

const EventsListHeader = ({
	theme,
	selectedTagIds,
	selectedTagNames,
	searchRadius,
	areTagsLoading,
	tagsError,
	error,
	onOpenFilterSheet,
	onClearTags,
	onRadiusChange,
	onRetryTags,
	onRetryEvents,
}: EventsListHeaderProps) => {
	const palette = Colors[theme];
	const highlightColor = palette.filterActivePill;
	const preview = selectedTagNames.slice(0, 2).join(', ');
	const remaining = Math.max(0, selectedTagIds.length - 2);

	return (
		<View style={[styles.listHeader, { backgroundColor: palette.background }]}>
			<Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Upcoming events</Text>

			<View style={styles.headerControlsRow}>
				<View style={styles.filterButtonRow}>
					<TouchableOpacity
						onPress={onOpenFilterSheet}
						style={[styles.filterButton, styles.filterButtonLarge, { backgroundColor: palette.actionButton }]}
						activeOpacity={0.9}
						accessibilityLabel={selectedTagIds.length ? `Filters, ${selectedTagIds.length} active` : 'Filters'}
						accessibilityRole="button"
					>
						<MaterialIcons name="tune" size={18} color={palette.filterTextActive} style={styles.filterButtonIcon} />
						<Text style={[styles.filterButtonText, { color: palette.filterTextActive }]}>
							Filters{selectedTagIds.length ? ` (${selectedTagIds.length})` : ''}
						</Text>
					</TouchableOpacity>
					{selectedTagIds.length ? (
						<TouchableOpacity
							onPress={onClearTags}
							style={[styles.inlineClearButton, { borderColor: highlightColor }]}
							activeOpacity={0.85}
							accessibilityLabel="Clear tag filters"
							accessibilityRole="button"
						>
							<Text style={[styles.inlineClearText, { color: highlightColor }]}>Clear</Text>
						</TouchableOpacity>
					) : null}
				</View>
				<View style={styles.radiusColumn}>
					<RadiusSelector value={searchRadius} onChange={onRadiusChange} theme={theme} />
				</View>
			</View>

			{selectedTagNames.length ? (
				<Text style={[styles.selectedTagsText, { color: palette.cardSubtitle }]}>
					{preview}{remaining ? ` +${remaining} more` : ''}
				</Text>
			) : null}

			{tagsError ? (
				<TouchableOpacity
					onPress={onRetryTags}
					style={[styles.filterLoadRow, { borderColor: highlightColor }]}
					accessibilityLabel="Could not load tags. Tap to retry."
					accessibilityRole="button"
				>
					<Text style={[styles.filterLoadText, { color: palette.cardTitle }]}>Could not load tags. Tap to retry.</Text>
				</TouchableOpacity>
			) : null}

			{areTagsLoading ? (
				<View style={styles.filterLoadRow}>
					<ActivityIndicator size="small" color={highlightColor} />
					<Text style={[styles.filterLoadText, { color: palette.cardSubtitle }]}>Loading tags...</Text>
				</View>
			) : null}

			{error ? (
				<View
					style={[
						styles.errorBanner,
						{ backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder },
					]}
				>
					<Text style={[styles.errorTitle, { color: palette.networkErrorText }]}>Unable to load events</Text>
					<Text style={[styles.errorDescription, { color: palette.networkErrorText }]}>{error}</Text>
					<TouchableOpacity
						style={[styles.retryButton, { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder }]}
						onPress={onRetryEvents}
						accessibilityLabel="Try again"
						accessibilityRole="button"
					>
						<Text style={[styles.retryButtonText, { color: palette.networkErrorText }]}>Try again</Text>
					</TouchableOpacity>
				</View>
			) : null}
		</View>
	);
};

// Main Events Screen component
const EventsScreen = () => {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const router = useRouter();
	const searchParams = useLocalSearchParams<{ eventTagId?: string | string[] }>();
	const initialSelectedTagIds = useMemo(
		() => normalizeTagIds(normalizeTagParamList(searchParams.eventTagId)),
		[searchParams.eventTagId]
	);
	const hasAppliedInitialTagsRef = useRef(false);

	const [events, setEvents] = useState<Event[]>([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isPaginating, setIsPaginating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialSelectedTagIds);
	const [availableTags, setAvailableTags] = useState<EventTag[]>([]);
	const [areTagsLoading, setAreTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string | null>(null);
	const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
	const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_RADIUS_MILES);
	const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
	const eventsRequestAbortRef = useRef<AbortController | null>(null);
	const eventsRequestSeqRef = useRef(0);
	const isMountedRef = useRef(true);
	const eventsCacheRef = useRef<EventsCache | null>(null);

	useEffect(() => {
		if (hasAppliedInitialTagsRef.current) {
			return;
		}
		setSelectedTagIds(initialSelectedTagIds);
		hasAppliedInitialTagsRef.current = true;
	}, [initialSelectedTagIds]);

	// Function to fetch available event tags
	const fetchAvailableTags = useCallback(async () => {
		if (!API_BASE_URL) {
			setTagsError('Set EXPO_PUBLIC_API_URL in your .env file to load event tags.');
			setAvailableTags([]);
			return;
		}

		setAreTagsLoading(true);
		try {
			setTagsError(null);
			const response = await fetch(EVENT_TAGS_ENDPOINT);
			if (!response.ok) {
				throw new Error(`Failed to fetch tags (status ${response.status})`);
			}

			const payload = await response.json();
			const incoming = extractTagItems(payload).map(mapToEventTag);
			setAvailableTags(incoming);
		} catch (err) {
			setTagsError(err instanceof Error ? err.message : 'Unable to load event tags right now.');
		} finally {
			setAreTagsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAvailableTags();
	}, [fetchAvailableTags]);

	// Memoized list of selected tag names for display
	const selectedTagNames = useMemo(
		() => availableTags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.name),
		[availableTags, selectedTagIds]
	);

	// Handler for applying tag filters; abort in-flight, clear stale results, and reset paging
	const handleApplyFilters = useCallback((nextTagIds: string[]) => {
		eventsRequestAbortRef.current?.abort();
		setIsInitialLoading(true);
		setEvents([]);
		setError(null);
		eventsCacheRef.current = null;
		setSelectedTagIds(normalizeTagIds(nextTagIds));
		setPage(1);
		setHasMore(true);
	}, []);

	// Handler for clearing tag filters
	const handleClearTags = useCallback(() => {
		eventsRequestAbortRef.current?.abort();
		setIsInitialLoading(true);
		setEvents([]);
		setError(null);
		eventsCacheRef.current = null;
		setSelectedTagIds([]);
		setPage(1);
		setHasMore(true);
	}, []);

	// Handlers for opening and closing the filter sheet
	const openFilterSheet = useCallback(() => {
		setIsFilterSheetVisible(true);
	}, []);

	const closeFilterSheet = useCallback(() => {
		setIsFilterSheetVisible(false);
	}, []);

	// Handler for opening event details
	const handleOpenEvent = useCallback(
		(event: Event) => {
			const instanceId = event.instance_id;
			if (!instanceId) {
				return;
			}
			router.push({ pathname: '/event/[instanceId]', params: { instanceId } });
		},
		[router]
	);

	// Handler for radius change
	const handleRadiusChange = useCallback((nextRadius: number) => {
		setSearchRadius(Math.max(1, nextRadius));
	}, []);

	// Function to ensure location permission is granted
	const ensureLocationPermission = useCallback(async (): Promise<boolean> => {
		const current = await Location.getForegroundPermissionsAsync();
		if (current.status === 'granted') {
			return true;
		}
		if (!current.canAskAgain) {
			return false;
		}
		const requested = await Location.requestForegroundPermissionsAsync();
		return requested.status === 'granted';
	}, []);

	// Function to refresh user location — deduplicates identical coord updates to avoid spurious re-fetches
	const refreshUserLocation = useCallback(async () => {
		try {
			const granted = await ensureLocationPermission();
			if (!granted) {
				return;
			}
			const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
			const lat = position.coords.latitude;
			const lon = position.coords.longitude;
			setUserCoords((prev) => (prev?.lat === lat && prev?.lon === lon ? prev : { lat, lon }));
		} catch {
			// Location unavailable; caller will use fallback coordinates
		}
	}, [ensureLocationPermission]);

	// Fetch events function
	const fetchEvents = useCallback(
		async (pageToLoad: number, mode: FetchMode) => {
			// Cancel any in-flight request so stale responses cannot clobber fresh data
			const requestId = eventsRequestSeqRef.current + 1;
			eventsRequestSeqRef.current = requestId;
			eventsRequestAbortRef.current?.abort();
			const controller = new AbortController();
			eventsRequestAbortRef.current = controller;

			setIsPaginating(mode === 'paginate');
			setIsRefreshing(mode === 'refresh');
			setIsInitialLoading(mode === 'initial');

			if (!API_BASE_URL) {
				setError('Set EXPO_PUBLIC_API_URL in your .env file to load events.');
				setIsPaginating(false);
				setIsRefreshing(false);
				setIsInitialLoading(false);
				return;
			}

			try {
				setError(null);
				const coordsToUse = userCoords ?? {
					lat: DEFAULT_COORDS.lat,
					lon: DEFAULT_COORDS.lon,
				};
				const cacheKey = getCacheKey(coordsToUse, selectedTagIds, searchRadius);

				// Serve cached data on initial/refresh when valid
				if (mode !== 'paginate' && eventsCacheRef.current) {
					const cached = eventsCacheRef.current;
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
				// Build the API query to match the backend contract
				const queryParams: QueryParams = {
					upcoming: 'true',
					limit: PAGE_SIZE,
					page: pageToLoad,
					lat: coordsToUse.lat,
					lon: coordsToUse.lon,
					radius: searchRadius,
					unit: DISTANCE_UNIT,
				};

				// Single-select: the filter sheet enforces at most one tag at a time
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
					typeof pageMeta?.current_page === 'number'
						? pageMeta.current_page
						: pageToLoad;

				if (!isMountedRef.current || eventsRequestSeqRef.current !== requestId) {
					return;
				}

				setEvents((prev) => (mode === 'paginate' ? mergeEvents(prev, incoming) : incoming));
				setPage(resolvedPage);
				setHasMore(hasMoreNext);

				// Cache successful result
				eventsCacheRef.current = {
					key: cacheKey,
					timestamp: Date.now(),
					data: mode === 'paginate'
						? mergeEvents(eventsCacheRef.current?.data ?? [], incoming)
						: incoming,
					currentPage: resolvedPage,
					hasMore: hasMoreNext,
				};
			} catch (err) {
				if ((err as Error).name === 'AbortError') {
					return;
				}
				if (!isMountedRef.current || eventsRequestSeqRef.current !== requestId) {
					return;
				}
				setError(err instanceof Error ? err.message : 'Unable to load events right now.');
			} finally {
				// Only clear loading flags if this is the latest in-flight request and we are still mounted
				if (!isMountedRef.current || eventsRequestSeqRef.current !== requestId) {
					return;
				}
				eventsRequestAbortRef.current = null;
				setIsPaginating(false);
				setIsRefreshing(false);
				setIsInitialLoading(false);
			}
		},
		[searchRadius, selectedTagIds, userCoords]
	);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
			eventsRequestSeqRef.current += 1;
			eventsRequestAbortRef.current?.abort();
			eventsRequestAbortRef.current = null;
		};
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

	const renderItem = useCallback<ListRenderItem<EventListRow>>(
		({ item }) => {
			if (item.type === 'date') {
				return (
					<View
						style={[
							styles.dateSeparatorPill,
							{ backgroundColor: palette.container, borderColor: palette.border },
						]}
					>
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
		if (events.length === 0) {
			return [] as Event[];
		}

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

	// Build rows with date separators
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

	const ListEmpty = useCallback(() => {
		if (isInitialLoading) {
			return (
				<View style={styles.emptyState}>
					<ActivityIndicator color={palette.actionButton} size="large" />
					<Text style={[styles.emptyStateText, { color: palette.filterTextActive }]}>Loading events...</Text>
				</View>
			);
		}

		if (error) {
			// Header banner already shows the error with a retry button — avoid duplicating it here
			return null;
		}

		return (
			<View style={styles.emptyState}>
				<Text style={[styles.emptyStateTitle, { color: palette.filterText }]}>Nothing scheduled yet</Text>
				<Text style={[styles.emptyStateText, { color: palette.filterText }]}>
					We could not find upcoming events for the selected tags.
				</Text>
			</View>
		);
	}, [error, isInitialLoading, palette]);

	const ListFooter = useCallback(() => {
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

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}>
			<FlatList
				data={listRows}
				keyExtractor={(item) => item.key}
				renderItem={renderItem}
				ListHeaderComponent={ListHeader}
				contentContainerStyle={
					listRows.length === 0 ? styles.listContentEmpty : styles.listContent
				}
				ListEmptyComponent={ListEmpty}
				ListFooterComponent={ListFooter}
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
};

export default EventsScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
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
	listHeader: {
		paddingTop: 12,
		paddingHorizontal: 20,
		paddingBottom: 12,
		zIndex: 30,
		elevation: 30,
		overflow: 'visible',
		position: 'relative',
	},
	headerControlsRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
		marginTop: 12,
		flexWrap: 'wrap',
		position: 'relative',
		overflow: 'visible',
	},
	radiusColumn: {
		flex: 1,
		minWidth: 0,
	},
	filterButtonRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flexShrink: 0,
	},
	screenTitle: {
		fontSize: 26,
		fontWeight: '700',
	},
	radiusPickerContainer: {
		position: 'relative',
		alignSelf: 'flex-start',
		zIndex: 20,
		elevation: 20,
	},
	radiusPickerButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		minWidth: 160,
		gap: 10,
	},
	radiusPickerValue: {
		fontSize: 15,
		fontWeight: '700',
	},
	radiusPickerDropdown: {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		marginTop: 6,
		borderRadius: 12,
		borderWidth: 1,
		paddingVertical: 6,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOpacity: 0.18,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 22,
		zIndex: 22,
	},
	radiusPickerOption: {
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	radiusPickerOptionText: {
		fontSize: 15,
		fontWeight: '700',
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
	},
	inlineClearButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		borderWidth: 1.5,
	},
	inlineClearText: {
		fontSize: 14,
		fontWeight: '600',
	},
	selectedTagsText: {
		fontSize: 13,
		marginTop: 6,
		fontStyle: 'italic',
	},
	filterLoadRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 8,
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 8,
		borderWidth: 1,
	},
	filterLoadText: {
		fontSize: 13,
	},
	errorBanner: {
		marginTop: 12,
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		gap: 6,
	},
	errorTitle: {
		fontSize: 15,
		fontWeight: '700',
	},
	errorDescription: {
		fontSize: 13,
	},
	retryButton: {
		marginTop: 4,
		alignSelf: 'flex-start',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
	},
	retryButtonText: {
		fontSize: 13,
		fontWeight: '600',
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
