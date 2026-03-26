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
import type { Event, EventTag, QueryParams, ThemeName } from '@/types/index';

// Components
import EventCard from '@/components/eventCard';
import EventTagFilterSheet from '@/components/eventTagFilterSheet';

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
type Coordinates = { lat: number; lon: number };
type QueryValue = string | number | boolean | undefined | (string | number | boolean)[];

// Flat list rows (date separators and events)
type EventListRow =
	| { type: 'date'; key: string; label: string }
	| { type: 'event'; key: string; event: Event };

type EventsCache = {
	key: string;
	timestamp: number;
	data: Event[];
	currentPage: number;
	hasMore: boolean;
};

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


// Main Events Screen component
const EventsScreen = () => {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const router = useRouter();
	const searchParams = useLocalSearchParams<{ eventTagId?: string | string[] }>();
	const initialTagIdsFromParams = useMemo(
		() => normalizeTagParamList(searchParams.eventTagId),
		[searchParams.eventTagId]
	);
	const initialSelectedTagIds = normalizeTagIds(initialTagIdsFromParams);
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

	// Handlers for opening and closing the filter sheet
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
			console.warn('Location permission permanently denied; using fallback coordinates.');
			return false;
		}
		const requested = await Location.requestForegroundPermissionsAsync();
		return requested.status === 'granted';
	}, []);

	// Function to refresh user location
	const refreshUserLocation = useCallback(async () => {
		try {
			const granted = await ensureLocationPermission();
			if (!granted) {
				return;
			}
			const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
			setUserCoords({
				lat: position.coords.latitude,
				lon: position.coords.longitude,
			});
		} catch (err) {
			console.warn('Unable to fetch user location; using fallback coordinates.', err);
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
				const cacheKey = getCacheKey(coordsToUse, selectedTagIds);

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
				// Build the API query to match the backend contract (no extra pagination params)
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
		[userCoords, searchRadius, selectedTagIds]
	);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
			eventsRequestSeqRef.current += 1;
			eventsRequestAbortRef.current?.abort();
			eventsRequestAbortRef.current = null;
		};
	}, []);

	useEffect(() => {
		refreshUserLocation();
	}, [refreshUserLocation]);

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

	// Indices for sticky date headers (offset by ListHeaderComponent at index 0)
	const stickyHeaderIndices = useMemo(() => {
		const headerOffset = 1; // ListHeaderComponent is rendered before data rows
		return listRows
			.map((row, index) => (row.type === 'date' ? index + headerOffset : -1))
			.filter((index) => index >= 0);
	}, [listRows]);

	const renderHeader = useMemo(() => {
		const highlightColor = Colors[theme].filterActivePill;
		const preview = selectedTagNames.slice(0, 2).join(', ');
		const remaining = Math.max(0, selectedTagIds.length - 2);

		return (
			<View
				style={[
					styles.listHeader,
					{ backgroundColor: palette.background },
				]}
			>
				<Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Upcoming events</Text>

				<View style={styles.headerControlsRow}>
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
								Filters{selectedTagIds.length ? ` (${selectedTagIds.length})` : ''}
							</Text>
						</TouchableOpacity>
						{selectedTagIds.length ? (
							<TouchableOpacity
								onPress={handleClearTags}
								style={[styles.inlineClearButton, { borderColor: highlightColor }]}
								activeOpacity={0.85}
							>
								<Text style={[styles.inlineClearText, { color: highlightColor }]}>Clear</Text>
							</TouchableOpacity>
						) : null}
					</View>
					<View style={styles.radiusColumn}>
						<RadiusSelector value={searchRadius} onChange={handleRadiusChange} theme={theme} />
					</View>
				</View>

				{selectedTagNames.length ? (
					<Text style={[styles.selectedTagsText, { color: palette.cardSubtitle }]}>
						{preview}
						{remaining ? ` +${remaining} more` : ''}
					</Text>
				) : null}

				{tagsError ? (
					<TouchableOpacity
						onPress={fetchAvailableTags}
						style={[styles.filterLoadRow, { borderColor: highlightColor }]}
					>
						<Text style={[styles.filterLoadText, { color: palette.cardTitle }]}>
							Could not load tags. Tap to retry.
						</Text>
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
							style={[styles.retryButton, { backgroundColor: palette.networkErrorBackground }]}
							onPress={handleRetry}
						>
							<Text style={[styles.retryButtonText, { color: palette.networkErrorText }]}>Try again</Text>
						</TouchableOpacity>
					</View>
				) : null}
			</View>
		);
	}, [
		areTagsLoading,
		error,
		fetchAvailableTags,
		handleClearTags,
		handleRadiusChange,
		handleRetry,
		openFilterSheet,
		searchRadius,
		selectedTagIds,
		selectedTagNames,
		tagsError,
		theme,
		palette,
	]);

	const renderEmpty = useMemo(() => {
		if (isInitialLoading) {
			return (
				<View style={styles.emptyState}>
					<ActivityIndicator color={palette.actionButton} size="large" />
					<Text style={[styles.emptyStateText, { color: palette.filterTextActive }]}>Loading events...</Text>
				</View>
			);
		}

		if (error) {
			return (
				<View style={styles.emptyState}>
					<Text style={[styles.emptyStateTitle, { color: palette.filterText }]}>No events to show</Text>
					<Text style={[styles.emptyStateText, { color: palette.filterText }]}>
						Adjust the filters above and try again.
					</Text>
				</View>
			);
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

	const renderFooter = useMemo(() => {
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
				stickyHeaderIndices={stickyHeaderIndices}
				ListHeaderComponent={renderHeader}
				contentContainerStyle={
					listRows.length === 0 ? styles.listContentEmpty : styles.listContent
				}
				ListEmptyComponent={renderEmpty}
				ListFooterComponent={renderFooter}
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
		backgroundColor: '#f5f5f5',
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
	sectionHeaderText: {
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.3,
		textTransform: 'uppercase',
	},
	screenTitle: {
		fontSize: 26,
		fontWeight: '700',
	},
	radiusTitle: {
		fontSize: 16,
		fontWeight: '700',
	},
	radiusSubtitle: {
		fontSize: 13,
		lineHeight: 18,
	},
	radiusInputWrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 4,
		alignSelf: 'flex-start',
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
		borderWidth: 1,
	},
	inlineClearText: {
		fontSize: 14,
		fontWeight: '700',
	},
	selectedTagsText: {
		marginTop: 8,
		fontSize: 14,
		fontWeight: '600',
	},
	filterLoadRow: {
		marginTop: 10,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 8,
		paddingHorizontal: 10,
		borderRadius: 10,
		borderWidth: 1,
	},
	filterLoadText: {
		fontSize: 14,
		fontWeight: '600',
	},
	filterHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	filterTitle: {
		fontSize: 16,
		fontWeight: '600',
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
	filterStateRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	filterStateColumn: {
		gap: 8,
	},
	filterStateText: {
		fontSize: 14,
	},
	filterStateErrorText: {
		fontSize: 14,
		fontWeight: '600',
	},
	filterStateRetryButton: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	filterStateRetryText: {
		fontSize: 14,
		fontWeight: '600',
	},
	sheetScrim: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'transparent',
	},
	sheetContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: 22,
		borderTopRightRadius: 22,
		borderWidth: 1,
		padding: 20,
		maxHeight: '50%',
		shadowColor: '#000',
		shadowOpacity: 0.25,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: -4 },
		elevation: 10,
	},
	sheetTitle: {
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
		marginBottom: 14,
	},
	filterSearchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	filterSearchInput: {
		flex: 1,
		fontSize: 15,
		fontWeight: '600',
	},
	filterList: {
		marginTop: 14,
	},
	filterEmptyContent: {
		flexGrow: 1,
	},
	filterEmptyState: {
		alignItems: 'center',
		paddingVertical: 20,
	},
	filterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 4,
		gap: 12,
	},
	filterRowCheckbox: {
		marginLeft: 4,
	},
	filterRowLabel: {
		fontSize: 15,
		fontWeight: '600',
		flexShrink: 1,
	},
	filterActionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		marginTop: 16,
	},
	filterActionButton: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
	},
	filterActionGhost: {
		backgroundColor: '#f3f4f6',
	},
	filterActionGhostText: {
		fontSize: 15,
		fontWeight: '700',
	},
	filterActionPrimary: {
	},
	filterActionPrimaryText: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '700',
	},
	errorBanner: {
		marginTop: 16,
		padding: 16,
		borderRadius: 12,
		backgroundColor: '#fef2f2',
		borderWidth: 1,
		borderColor: '#fecaca',
	},
	errorTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#b91c1c',
		marginBottom: 4,
	},
	errorDescription: {
		color: '#991b1b',
		marginBottom: 12,
	},
	retryButton: {
		alignSelf: 'flex-start',
		backgroundColor: '#b91c1c',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 999,
	},
	retryButtonText: {
		color: '#ffffff',
		fontWeight: '600',
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
	eventBarRow: {
		marginTop: 4,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	eventBarIcon: {
		opacity: 0.9,
	},
	eventBarName: {
		fontSize: 16,
		fontWeight: '600',
		letterSpacing: 0.25,
		textTransform: 'none',
	},
	eventTagPill: {
		alignSelf: 'flex-start',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		marginBottom: 10,
	},
	eventTagLabel: {
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	eventTitle: {
		fontSize: 20,
		fontWeight: '700',
		marginTop: 2,
	},
	eventTitleDivider: {
		height: 1,
		marginTop: 20,
		marginBottom: 8,
		borderRadius: 999,
		width: '100%',
		alignSelf: 'stretch',
	},
	metaRow: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 8,
	},
	distancePill: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	metaDot: {
		width: 5,
		height: 5,
		borderRadius: 999,
	},
	metaDistanceText: {
		fontSize: 13,
		fontWeight: '500',
	},
	eventMeta: {
		fontSize: 15,
		color: '#4b5563',
		fontWeight: '600',
	},
	scheduleBlock: {
		marginTop: 8,
		gap: 12,
	},
	distanceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
		gap: 4,
	},
	distanceRowBottom: {
		marginTop: 18,
	},
	distanceIcon: {
		marginRight: 2,
	},
	distanceText: {
		fontSize: 13,
		fontWeight: '500',
	},
	timeRowSimple: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		flexWrap: 'wrap',
	},
	timePair: {
		flexDirection: 'column',
		gap: 2,
	},
	timeIcon: {
		opacity: 0.85,
	},
	timeArrowIcon: {
		marginHorizontal: 2,
		opacity: 0.7,
	},
	timeLabelInline: {
		fontSize: 12,
		fontWeight: '600',
		letterSpacing: 0.2,
		textTransform: 'uppercase',
	},
	timeValueInline: {
		fontSize: 16,
		fontWeight: '700',
	},
	timeRow: {
		flexDirection: 'row',
		marginTop: 12,
		borderWidth: 1,
		borderColor: '#e5e7eb',
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
		borderLeftColor: '#e5e7eb',
	},
	timeLabel: {
		fontSize: 12,
		fontWeight: '600',
		color: '#6b7280',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	timeValue: {
		marginTop: 6,
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
	},
	tagRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 12,
	},
	tagRowTop: {
		marginTop: 0,
		marginBottom: 12,
	},
	tagPill: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
		backgroundColor: '#f0fdf4',
		borderWidth: 1,
		borderColor: '#86efac',
		marginRight: 8,
		marginBottom: 8,
	},
	tagText: {
		color: '#15803d',
		fontSize: 13,
		fontWeight: '600',
	},
	emptyState: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60,
		paddingHorizontal: 24,
	},
	emptyStateTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#111827',
		marginBottom: 8,
	},
	emptyStateText: {
		textAlign: 'center',
		color: '#6b7280',
	},
	listFooter: {
		paddingVertical: 24,
		alignItems: 'center',
	},
	footerText: {
		color: '#6b7280',
	},
});
