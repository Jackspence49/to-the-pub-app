import { MaterialIcons } from '@expo/vector-icons'; // Icon library
import * as Location from 'expo-location'; // Location services
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; // Navigation and routing
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListRenderItem } from 'react-native';

// React Native components
import {
	ActivityIndicator,
	FlatList,
	Modal,
	Pressable,
	RefreshControl,
	SectionList,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

// Custom constants and hooks
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';


// Type definitions
type FetchMode = 'initial' | 'refresh' | 'paginate';
type LooseObject = Record<string, any>;
type ThemeName = keyof typeof Colors; 
type Coordinates = { lat: number; lon: number };
type EventThemeTokens = ReturnType<typeof getEventThemeTokens>;
type QueryValue = string | number | boolean | undefined | (string | number | boolean)[];

// Event card props type definition
type EventCardProps = {
	event: EventInstance;
	availableTags: EventTag[];
	tokens: EventThemeTokens;
	onPress?: () => void;
};

// Event tag type definition
type EventTag = {
	id: string;
	name: string;
	description?: string;
	slug?: string;
};

// Event instance type definition
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
	distanceMiles?: number;
};

// Default Parameters
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 6;
const DEFAULT_RADIUS_MILES = 10;
const DISTANCE_UNIT = 'miles';
const RADIUS_OPTIONS = [1, 3, 5, 10];
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

const DEFAULT_COORDINATES = {
	latitude: 42.3555,
	longitude: -71.0565,
};

// Function to get theme tokens based on current theme
const getEventThemeTokens = (theme: ThemeName) => {
	const palette = Colors[theme];
	return {
		background: palette.background,
		container: palette.container,
		border: palette.border,
		headerBorder: palette.border,
		cardTitle: palette.cardTitle,
		subcardTitle: palette.cardSubtitle,
		icon: palette.icon,
		iconSelected: palette.iconSelected,
		activePill: palette.activePill,
		filterContainer: palette.filterContainer,
		filterText: palette.filterText,
		filterTextActive: palette.filterTextActive,
		filterActivePill: palette.filterActivePill,
		cardSurface: palette.cardSurface,
		cardSubtitle: palette.cardSubtitle,
		cardText: palette.cardText,
		pillBackground: palette.pillBackground,
		pillText: palette.pillText,
		pillBorder: palette.pillBorder,
		warningBackground: palette.warningBackground,
		warningBorder: palette.warningBorder,
		warningText: palette.warningText,
		actionButton: palette.actionButton,
		dismissButton: palette.dismissButton,
		networkErrorBackground: palette.networkErrorBackground,
		networkErrorButton: palette.networkErrorButton,
		networkErrorBorder: palette.networkErrorBorder,
		networkErrorText: palette.networkErrorText,
		errorBackground: palette.networkErrorBackground,
		errorBorder: palette.networkErrorBorder,
		errorTitle: palette.cardTitle,
		errorDescription: palette.cardSubtitle,
		retryBackground: palette.networkErrorBackground,
		retryText: palette.networkErrorText,
		indicator: palette.iconSelected,
		emptyText: palette.cardSubtitle,
		emptyTitle: palette.cardTitle,
		footerText: palette.filterText,
		cardBackground: palette.cardSurface,
		cardBorder: palette.border,
	};
};


// Utility function to normalize tag parameter list
const normalizeTagParamList = (value?: string | string[]): string[] => {
	if (!value) {
		return [];
	}

	const rawList = Array.isArray(value) ? value : value.split(',');
	return rawList
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
};

// Utility function to build query strings

// Utility function to build query strings
const buildQueryString = (params: Record<string, QueryValue>) =>
	Object.entries(params)
		.flatMap(([key, value]) => {
			if (value === undefined || value === '') {
				return [];
			}

			if (Array.isArray(value)) {
				return value
					.filter((entry) => entry !== undefined && entry !== '')
					.map((entry) =>
						`${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`
					);
			}

			return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
		})
		.join('&');

// Function to extract event items from various API response structures
const extractEventItems = (payload: unknown): LooseObject[] => {
	if (!payload) {
		return [];
	}

	if (Array.isArray(payload)) {
		return payload as LooseObject[];
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

// Function to extract tag items from various API response structures
const extractTagItems = (payload: unknown): LooseObject[] => {
	if (!payload) {
		return [];
	}

	if (Array.isArray(payload)) {
		return payload as LooseObject[];
	}

	const record = payload as LooseObject;
	const candidates = [
		record.data?.tags,
		record.data?.items,
		record.data,
		record.tags,
		record.event_tags,
		record.items,
		record.results,
	];

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate as LooseObject[];
		}
	}

	return [];
};

// Function to extract pagination metadata from various API response structures
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

// Function to determine if more pages should be fetched based on pagination metadata
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

// Function to map raw event data to EventInstance type
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

	const eventTagName =
		raw.event_tag?.name ??
		raw.event_tag_name ??
		raw.tag_name ??
		raw.tag?.name ??
		raw.event_tag ??
		raw.event_tag_id ??
		undefined;

	const distanceMiles = (() => {
		const candidates = [raw.distance_miles, raw.distanceMiles, raw.distance];
		const numeric = candidates.find((entry) => typeof entry === 'number');
		return typeof numeric === 'number' ? numeric : undefined;
	})();

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
		distanceMiles,
	};
};

// Function to map raw tag data to EventTag type
const mapToEventTag = (raw: LooseObject): EventTag => {
	const fallbackId =
		raw.id ??
		raw.tag_id ??
		raw.uuid ??
		raw.slug ??
		raw.name ??
		`tag-${Date.now()}`;

	return {
		id: String(fallbackId),
		name: raw.name ?? raw.title ?? raw.label ?? `Tag ${fallbackId}`,
		description: raw.description ?? raw.summary ?? undefined,
		slug: raw.slug ?? raw.handle ?? undefined,
	};
};

// Function to merge current and incoming event lists, deduping by ID
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

// Function to normalize date-only strings (YYYY-MM-DD) and apply optional day offset
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

// Function to combine date-only and time-only strings into a full datetime string
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

// Function to get the start of day for a given date
const startOfDay = (input: Date) => {
	const copy = new Date(input);
	copy.setHours(0, 0, 0, 0);
	return copy;
};

// Function to format event time strings
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


// Function to format distance values
const formatDistance = (value?: number): string | null => {
	if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
		return null;
	}

	if (value < 0.1) {
		return `< 0.1 ${DISTANCE_UNIT} away`;
	}

	const formatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: value < 10 ? 1 : 0,
	});

	return `${formatter.format(value)} ${DISTANCE_UNIT} away`;
};

// Event card component
const EventCard = ({ event, availableTags, tokens, onPress }: EventCardProps) => {
	const barName = event.barName ?? event.venueName ?? 'Bar coming soon';
	const startTimeLabel = formatEventTime(event.startsAt);
	const endTimeLabel = formatEventTime(event.endsAt);
	const distanceLabel = formatDistance(event.distanceMiles);
	// Gather all tag IDs (eventTagName and tags[]), filter out falsy, dedupe, and slice
	const tagIds = Array.from(
		new Set([
			event.eventTagName,
			...(event.tags ?? [])
		].filter(Boolean) as string[])
	).slice(0, 3);
	// Map tag IDs to tag names using availableTags
	const tagsToRender = tagIds.map(
		(tagId) => availableTags.find((t) => t.id === tagId)?.name || tagId
	);
	const eventTagName = tagsToRender[0];

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
				},
			]}
		>
			<View style={styles.cardBody}>
				{eventTagName ? (
					<View
						style={[
							styles.eventTagPill,
							{
								backgroundColor: tokens.filterActivePill,
							},
						]}
					>
						<Text style={[styles.eventTagLabel, { color: tokens.filterTextActive }]}>{eventTagName}</Text>
					</View>
				) : null}
				<Text style={[styles.eventTitle, { color: tokens.cardTitle }]}>{event.title}</Text>
				<View style={[styles.eventTitleDivider, { backgroundColor: tokens.cardBorder }]} />
				<View style={styles.eventBarRow}>
					<MaterialIcons name="location-on" size={18} color={tokens.iconSelected} style={styles.eventBarIcon} />
					<Text style={[styles.eventBarName, { color: tokens.cardSubtitle }]}>{barName}</Text>
				</View>
				{distanceLabel ? (
					<View style={styles.metaRow}>
						<View
							style={[
								styles.distancePill,
								{
									backgroundColor: tokens.pillBackground,
								},
							]}
						>
							<Text style={[styles.metaDistanceText, { color: tokens.pillText }]}>{distanceLabel}</Text>
						</View>
					</View>
				) : null}
				<View style={styles.scheduleBlock}>
					<View style={styles.timeRowSimple}>
						<MaterialIcons name="schedule" size={18} color={tokens.iconSelected} style={styles.timeIcon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: tokens.cardSubtitle }]}>Start</Text>
							<Text style={[styles.timeValueInline, { color: tokens.cardTitle }]}>{startTimeLabel}</Text>
						</View>
						<MaterialIcons name="arrow-forward" size={16} color={tokens.cardSubtitle} style={styles.timeArrowIcon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: tokens.cardSubtitle }]}>End</Text>
							<Text style={[styles.timeValueInline, { color: tokens.cardTitle }]}>{endTimeLabel}</Text>
						</View>
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
};

type RadiusSelectorProps = {
	value: number;
	onChange: (value: number) => void;
	theme: ThemeName;
};

// Radius selector component
const RadiusSelector = ({ value, onChange, theme }: RadiusSelectorProps) => {
	const [isPickerVisible, setPickerVisible] = useState(false);

	const textColor = theme === 'light' ? '#111827' : '#f8fafc';
	const subtleText = theme === 'light' ? '#4b5563' : '#cbd5f5';
	const backgroundColor = theme === 'light' ? '#ffffff' : '#191f28';
	const inputBackground = theme === 'light' ? '#f9fafb' : '#10131a';
	const inputBorder = theme === 'light' ? '#e5e7eb' : '#2b313c';
	const inputText = theme === 'light' ? '#111827' : '#f3f4f6';

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
					style={[styles.radiusPickerButton, { borderColor: inputBorder, backgroundColor: inputBackground }]}
					onPress={() => setPickerVisible((prev) => !prev)}
					activeOpacity={0.85}
				>
					<Text style={[styles.radiusPickerValue, { color: inputText }]}>{currentLabel}</Text>
					<MaterialIcons name={isPickerVisible ? 'arrow-drop-up' : 'arrow-drop-down'} size={22} color={textColor} />
				</TouchableOpacity>

				{isPickerVisible ? (
					<View style={[styles.radiusPickerDropdown, { backgroundColor, borderColor: inputBorder }]}>
						{RADIUS_OPTIONS.map((option) => (
							<TouchableOpacity
								key={option}
								style={styles.radiusPickerOption}
								onPress={() => handleSelect(option)}
							>
								<Text style={[styles.radiusPickerOptionText, { color: option === value ? textColor : subtleText }]}>
									{option} {unitLabel}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				) : null}
			</View>
	);
};

// Props type definition for TagFilterSheet
type TagFilterSheetProps = {
	visible: boolean;
	tags: EventTag[];
	selectedTagIds: string[];
	onApply: (tagIds: string[]) => void;
	onClose: () => void;
	onRetry: () => void;
	isLoading: boolean;
	error: string | null;
	theme: ThemeName;
	tokens: EventThemeTokens;
};

// Tag filter sheet Modal component
const TagFilterSheet = ({
	visible,
	tags,
	selectedTagIds,
	onApply,
	onClose,
	onRetry,
	isLoading,
	error,
	theme,
	tokens,

}: TagFilterSheetProps) => {
	const palette = Colors[theme];
	const highlightColor = palette.filterActivePill;
	const [draftSelection, setDraftSelection] = useState<string[]>(selectedTagIds);

	useEffect(() => {
		if (visible) {
			setDraftSelection(selectedTagIds);
		}
	}, [selectedTagIds, visible]);

	const filteredTags = useMemo(() => {
		return tags;
	}, [tags]);

	const toggleTag = useCallback((tagId: string) => {
		setDraftSelection((previous) => {
			const next = previous.includes(tagId) ? [] : [tagId];
			onApply(next);
			onClose();
			return next;
		});
	}, [onApply, onClose]);

	// Render function for each tag row
	const renderTagRow = useCallback(
		({ item }: { item: EventTag }) => {
			const isChecked = draftSelection.includes(item.id);
			return (
				<TouchableOpacity
					style={styles.filterRow}
					onPress={() => toggleTag(item.id)}
					activeOpacity={0.8}
					accessibilityRole="radio"
					accessibilityState={{ selected: isChecked }}
				>
					<MaterialIcons
						name={isChecked ? 'radio-button-checked' : 'radio-button-unchecked'}
						size={22}
						color={isChecked ? highlightColor : palette.cardTitle}
						style={styles.filterRowCheckbox}
					/>
					<Text style={[styles.filterRowLabel, { color: palette.cardTitle }]} numberOfLines={1}>
						{item.name}
					</Text>
				</TouchableOpacity>
			);
		},
		[draftSelection, highlightColor, palette.text, toggleTag]
	);

	// Render the modal sheet
	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<Pressable style={styles.sheetScrim} onPress={onClose} />
			<View
				style={[
					styles.sheetContainer,
					{ backgroundColor: tokens.container, borderColor: tokens.headerBorder },
				]}
			>
				<Text style={[styles.sheetTitle, { color: tokens.cardTitle }]}>Filter Events</Text>

				{isLoading ? (
					<View style={styles.filterStateRow}>
						<ActivityIndicator color={highlightColor} />
						<Text style={[styles.filterStateText, { color: tokens.cardTitle }]}>Loading tags...</Text>
					</View>
				) : error ? (
					<View style={styles.filterStateColumn}>
						<Text style={[styles.filterStateErrorText, { color: tokens.cardTitle }]}>{error}</Text>
						<TouchableOpacity
							onPress={onRetry}
							style={[styles.filterStateRetryButton, { borderColor: highlightColor }]}
							activeOpacity={0.85}
						>
							<Text style={[styles.filterStateRetryText, { color: highlightColor }]}>Retry</Text>
						</TouchableOpacity>
					</View>
				) : (
					<FlatList
						data={filteredTags}
						keyExtractor={(item) => item.id}
						renderItem={renderTagRow}
						contentContainerStyle={filteredTags.length === 0 ? styles.filterEmptyContent : undefined}
						ListEmptyComponent={
							<View style={styles.filterEmptyState}>
								<Text style={[styles.filterStateText, { color: tokens.subcardTitle }]}>No tags available.</Text>
							</View>
						}
						style={styles.filterList}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
					/>
				)}
			</View>
		</Modal>
	);
};

// Main Events Screen component
const EventsScreen = () => {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = (colorScheme ?? 'light') as ThemeName;
	const tokens = useMemo(() => getEventThemeTokens(theme), [theme]);
	const searchParams = useLocalSearchParams<{ eventTagId?: string | string[] }>();
	const initialTagIdsFromParams = useMemo(
		() => normalizeTagParamList(searchParams.eventTagId),
		[searchParams.eventTagId]
	);
	const initialSelectedTagIds = initialTagIdsFromParams;

	const [events, setEvents] = useState<EventInstance[]>([]);
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

	useEffect(() => {
		setSelectedTagIds(initialTagIdsFromParams);
	}, [initialTagIdsFromParams]);


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
			const response = await fetch(`${normalizedBaseUrl}/event-tags`);
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

	// Handler for applying tag filters
	const handleApplyFilters = useCallback((nextTagIds: string[]) => {
		setSelectedTagIds(nextTagIds);
	}, []);

	// Handler for clearing tag filters
	const handleClearTags = useCallback(() => {
		setSelectedTagIds([]);
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
		(event: EventInstance) => {
			const instanceId = event.instanceId ?? event.id;
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
			if (mode === 'paginate') {
				setIsPaginating(true);
			} else if (mode === 'refresh') {
				setIsRefreshing(true);
			} else {
				setIsInitialLoading(true);
			}

			if (!API_BASE_URL) {
				setError('Set EXPO_PUBLIC_API_URL in your .env file to load events.');
				if (mode === 'paginate') {
					setIsPaginating(false);
				} else if (mode === 'refresh') {
					setIsRefreshing(false);
				} else {
					setIsInitialLoading(false);
				}
				return;
			}

			try {
				setError(null);
				const coordsToUse = userCoords ?? {
					lat: DEFAULT_COORDINATES.latitude,
					lon: DEFAULT_COORDINATES.longitude,
				};
				const queryParams: Record<string, QueryValue> = {
					upcoming: true,
					limit: PAGE_SIZE,
					page: pageToLoad,
					lon: coordsToUse.lon,
					lat: coordsToUse.lat,
					radius: searchRadius,
					unit: DISTANCE_UNIT,
				};

				if (selectedTagIds.length > 0) {
					queryParams.event_tag_id = selectedTagIds;
				}

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
		[userCoords, searchRadius, selectedTagIds]
	);

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

	const renderItem = useCallback<ListRenderItem<EventInstance>>(
		({ item }) => (
			<EventCard
				event={item}
				availableTags={availableTags}
				tokens={tokens}
				onPress={() => handleOpenEvent(item)}
			/>
		),
		[availableTags, handleOpenEvent, tokens]
	);

	const sections = useMemo(() => {
		if (events.length === 0) {
			return [] as { title: string; data: EventInstance[] }[];
		}

		const sorted = [...events].sort((a, b) => {
			const aDate = a.eventDate ?? a.startsAt ?? '';
			const bDate = b.eventDate ?? b.startsAt ?? '';
			const aTime = new Date(aDate).getTime();
			const bTime = new Date(bDate).getTime();
			const aValue = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
			const bValue = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
			return aValue - bValue;
		});

		const groups: Record<string, { title: string; data: EventInstance[]; order: number }> = {};

		sorted.forEach((event) => {
			const dateValue = event.eventDate ?? event.startsAt;
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

	const renderHeader = useMemo(() => {
		const highlightColor = Colors[theme].filterActivePill;
		const preview = selectedTagNames.slice(0, 2).join(', ');
		const remaining = Math.max(0, selectedTagIds.length - 2);

		return (
			<View
				style={[
					styles.listHeader,
					{ backgroundColor: tokens.background },
				]}
			>
				<Text style={[styles.screenTitle, { color: tokens.cardTitle }]}>Upcoming events</Text>

				<View style={styles.headerControlsRow}>
					<View style={styles.filterButtonRow}>
						<TouchableOpacity
							onPress={openFilterSheet}
							style={[styles.filterButton]}
							activeOpacity={0.9}
						>
							<MaterialIcons name="tune" size={18} color={tokens.cardTitle} style={styles.filterButtonIcon} />
							<Text style={[styles.filterButtonText, { color: tokens.cardTitle }]}>
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
					<Text style={[styles.selectedTagsText, { color: tokens.subcardTitle }]}>
						{preview}
						{remaining ? ` +${remaining} more` : ''}
					</Text>
				) : null}

				{tagsError ? (
					<TouchableOpacity
						onPress={fetchAvailableTags}
						style={[styles.filterLoadRow, { borderColor: highlightColor }]}
					>
						<Text style={[styles.filterLoadText, { color: tokens.cardTitle }]}>
							Could not load tags. Tap to retry.
						</Text>
					</TouchableOpacity>
				) : null}

				{areTagsLoading ? (
					<View style={styles.filterLoadRow}>
						<ActivityIndicator size="small" color={highlightColor} />
						<Text style={[styles.filterLoadText, { color: tokens.subcardTitle }]}>Loading tags...</Text>
					</View>
				) : null}

				{error ? (
					<View
						style={[
							styles.errorBanner,
							{ backgroundColor: tokens.errorBackground, borderColor: tokens.errorBorder },
						]}
					>
						<Text style={[styles.errorTitle, { color: tokens.errorTitle }]}>Unable to load events</Text>
						<Text style={[styles.errorDescription, { color: tokens.errorDescription }]}>{error}</Text>
						<TouchableOpacity
							style={[styles.retryButton, { backgroundColor: tokens.retryBackground }]}
							onPress={handleRetry}
						>
							<Text style={[styles.retryButtonText, { color: tokens.retryText }]}>Try again</Text>
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
		tokens,
	]);

	const renderEmpty = useMemo(() => {
		if (isInitialLoading) {
			return (
				<View style={styles.emptyState}>
					<ActivityIndicator color={tokens.indicator} size="large" />
					<Text style={[styles.emptyStateText, { color: tokens.emptyText }]}>Loading events...</Text>
				</View>
			);
		}

		if (error) {
			return (
				<View style={styles.emptyState}>
					<Text style={[styles.emptyStateTitle, { color: tokens.emptyTitle }]}>No events to show</Text>
					<Text style={[styles.emptyStateText, { color: tokens.emptyText }]}>
						Adjust the filters above and try again.
					</Text>
				</View>
			);
		}

		return (
			<View style={styles.emptyState}>
				<Text style={[styles.emptyStateTitle, { color: tokens.emptyTitle }]}>Nothing scheduled yet</Text>
				<Text style={[styles.emptyStateText, { color: tokens.emptyText }]}>
					We could not find upcoming events for the selected tags.
				</Text>
			</View>
		);
	}, [error, isInitialLoading, tokens]);

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
		<View style={[styles.container, { backgroundColor: tokens.background }]}>
			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				renderSectionHeader={({ section }) => (
					<View style={[styles.sectionHeader, { backgroundColor: tokens.background }]}>
						<View
							style={[
								styles.sectionHeaderPill,
								{ backgroundColor: tokens.container, borderColor: tokens.headerBorder },
							]}
						>
							<Text style={[styles.sectionHeaderText, { color: tokens.cardTitle }]}>
								{section.title}
							</Text>
						</View>
					</View>
				)}
				stickySectionHeadersEnabled
				ListHeaderComponent={renderHeader}
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
						tintColor={tokens.indicator}
						colors={[tokens.indicator]}
						progressBackgroundColor={tokens.container}
					/>
				}
				showsVerticalScrollIndicator={false}
			/>

			<TagFilterSheet
				visible={isFilterSheetVisible}
				tags={availableTags}
				selectedTagIds={selectedTagIds}
				onApply={handleApplyFilters}
				onClose={closeFilterSheet}
				onRetry={fetchAvailableTags}
				isLoading={areTagsLoading}
				error={tagsError}
				theme={theme}
				tokens={tokens}
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
	sectionHeader: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 6,
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
	screenTitle: {
		fontSize: 26,
		fontWeight: '700',
		color: '#111827',
	},
	screenSubtitle: {
		marginTop: 4,
		color: '#6b7280',
		fontSize: 15,
	},
	radiusCard: {
		marginTop: 20,
		padding: 12,
		borderRadius: 14,
		borderWidth: 1,
		gap: 8,
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
		backgroundColor: '#fff',
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
		backgroundColor: '#fff',
	},
	radiusPickerOption: {
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	radiusPickerOptionText: {
		fontSize: 15,
		fontWeight: '700',
	},
	filterSection: {
		marginTop: 20,
		padding: 18,
		borderRadius: 20,
		gap: 16,
	},
	filterSectionLight: {
		borderWidth: 1,
		borderColor: 'rgba(245, 165, 36, 0.35)',
		backgroundColor: '#fff9ef',
	},
	filterSectionDark: {
		borderWidth: 1,
		borderColor: 'rgba(246, 193, 91, 0.35)',
		backgroundColor: '#1f1a13',
	},
	filterButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 12,
		borderWidth: 1,
	},
	filterButtonIcon: {
		marginRight: 8,
	},
	filterButtonText: {
		fontSize: 15,
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
	cardImage: {
		width: '100%',
		height: 170,
		backgroundColor: '#f3f4f6',
	},
	cardImagePlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	cardImagePlaceholderText: {
		color: '#9ca3af',
		fontWeight: '600',
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
