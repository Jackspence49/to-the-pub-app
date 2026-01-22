import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
	ActivityIndicator,
	RefreshControl,
	SectionList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FetchMode = 'initial' | 'refresh' | 'paginate';

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

type EventTag = {
	id: string;
	name: string;
	description?: string;
	slug?: string;
};

type LooseObject = Record<string, any>;

type ThemeName = keyof typeof Colors;
type Coordinates = { lat: number; lon: number };

const TAG_PREVIEW_COUNT = 3;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 6;
const DEFAULT_COORDINATES = {
	latitude: 42.3555,
	longitude: -71.0565,
};

const DEFAULT_RADIUS_MILES = 10;
const DISTANCE_UNIT = 'miles';

const getEventThemeTokens = (theme: ThemeName) => {
	const isLight = theme === 'light';
	return {
		pageBackground: isLight ? '#f5f5f5' : '#050608',
		headerBackground: isLight ? '#ffffff' : '#161a20',
		headerBorder: isLight ? '#e5e7eb' : '#2a2f36',
		headingText: isLight ? '#111827' : '#f3f4f6',
		subheadingText: isLight ? '#6b7280' : '#9ca3af',
		cardBackground: isLight ? '#ffffff' : '#191f28',
		cardBorder: isLight ? '#e5e7eb' : '#2b313c',
		cardShadowColor: isLight ? '#111827' : '#000000',
		cardShadowOpacity: isLight ? 0.05 : 0.35,
		imageBackground: isLight ? '#f3f4f6' : '#101318',
		imagePlaceholderText: isLight ? '#9ca3af' : '#6b7280',
		eventBarLabel: isLight ? '#6b7280' : '#a0a8ba',
		eventTitle: isLight ? '#111827' : '#f8fafc',
		eventMeta: isLight ? '#4b5563' : '#cbd5f5',
		timeBorder: isLight ? '#e5e7eb' : '#2f3642',
		timeBackground: isLight ? '#f9fafb' : '#10131a',
		timeLabel: isLight ? '#6b7280' : '#a3acc2',
		timeValue: isLight ? '#111827' : '#f3f4f6',
		tagBackground: isLight ? '#f0fdf4' : '#0f1c14',
		tagBorder: isLight ? '#86efac' : '#14532d',
		tagText: isLight ? '#15803d' : '#4ade80',
		errorBackground: isLight ? '#fef2f2' : '#2d1313',
		errorBorder: isLight ? '#fecaca' : '#7f1d1d',
		errorTitle: isLight ? '#b91c1c' : '#fecdd3',
		errorDescription: isLight ? '#991b1b' : '#fda4af',
		retryBackground: isLight ? '#b91c1c' : '#7f1d1d',
		retryText: '#ffffff',
		emptyTitle: isLight ? '#111827' : '#f8fafc',
		emptyText: isLight ? '#6b7280' : '#9ca3af',
		footerText: isLight ? '#6b7280' : '#9ca3af',
		indicator: isLight ? '#111827' : '#f8fafc',
	};
};

type EventThemeTokens = ReturnType<typeof getEventThemeTokens>;

type QueryValue = string | number | boolean | undefined | (string | number | boolean)[];

const normalizeTagParamList = (value?: string | string[]): string[] => {
	if (!value) {
		return [];
	}

	const rawList = Array.isArray(value) ? value : value.split(',');
	return rawList
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
};

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

const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

type EventCardProps = {
	event: EventInstance;
	availableTags: EventTag[];
	tokens: EventThemeTokens;
	onPress?: () => void;
};
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
	const primaryTagName = tagsToRender[0];

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
					shadowColor: tokens.cardShadowColor,
					shadowOpacity: tokens.cardShadowOpacity,
				},
			]}
		>
			<View style={styles.cardBody}>
				{primaryTagName ? (
					<Text style={[styles.primaryTagLabel, { color: '#2563eb' }]}>{primaryTagName}</Text>
				) : null}
				<Text style={[styles.eventTitle, { color: tokens.eventTitle }]}>{event.title}</Text>
				<Text style={[styles.eventBarName, { color: tokens.eventBarLabel }]}>{barName}</Text>
				{distanceLabel ? (
					<View style={styles.metaRow}>
						<Text style={[styles.metaDistanceText, { color: tokens.eventMeta }]}>{distanceLabel}</Text>
					</View>
				) : null}
				<View style={styles.scheduleBlock}>
					<View
						style={[
							styles.timeRow,
							{ borderColor: tokens.timeBorder, backgroundColor: tokens.timeBackground },
						]}
					>
						<View style={styles.timeColumn}>
							<Text style={[styles.timeLabel, { color: tokens.timeLabel }]}>Start Time</Text>
							<Text style={[styles.timeValue, { color: tokens.timeValue }]}>{startTimeLabel}</Text>
						</View>
						<View
							style={[
								styles.timeColumn,
								styles.timeColumnRight,
								{ borderLeftColor: tokens.timeBorder },
							]}
						>
							<Text style={[styles.timeLabel, { color: tokens.timeLabel }]}>End Time</Text>
							<Text style={[styles.timeValue, { color: tokens.timeValue }]}>{endTimeLabel}</Text>
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

const RadiusSelector = ({ value, onChange, theme }: RadiusSelectorProps) => {
	const [radiusText, setRadiusText] = useState(String(value));

	useEffect(() => {
		setRadiusText(String(value));
	}, [value]);

	const textColor = theme === 'light' ? '#111827' : '#f8fafc';
	const subtleText = theme === 'light' ? '#4b5563' : '#cbd5f5';
	const borderColor = theme === 'light' ? '#e5e7eb' : '#2b313c';
	const backgroundColor = theme === 'light' ? '#ffffff' : '#191f28';
	const inputBackground = theme === 'light' ? '#f9fafb' : '#10131a';
	const inputBorder = theme === 'light' ? '#e5e7eb' : '#2b313c';
	const inputText = theme === 'light' ? '#111827' : '#f3f4f6';
	const placeholder = theme === 'light' ? '#9ca3af' : '#6b7280';

	const handleCommit = useCallback(() => {
		const parsed = Number(radiusText);
		if (!Number.isNaN(parsed) && parsed > 0) {
			onChange(parsed);
		} else {
			setRadiusText(String(value));
		}
	}, [onChange, radiusText, value]);

	return (
		<View style={[styles.radiusCard, { borderColor, backgroundColor }]}>
			<Text style={[styles.radiusTitle, { color: textColor }]}>Search radius</Text>
			<View style={[styles.radiusInputWrapper, { borderColor: inputBorder, backgroundColor: inputBackground }]}> 
				<TextInput
					style={[styles.radiusInput, { color: inputText }]}
					keyboardType="numeric"
					value={radiusText}
					onChangeText={setRadiusText}
					onBlur={handleCommit}
					onSubmitEditing={handleCommit}
					placeholder={`e.g. ${DEFAULT_RADIUS_MILES}`}
					placeholderTextColor={placeholder}
					returnKeyType="done"
					maxLength={4}
				/>
				<Text style={[styles.radiusUnitLabel, { color: subtleText }]}>{DISTANCE_UNIT === 'miles' ? 'mi' : DISTANCE_UNIT}</Text>
			</View>
		</View>
	);
};

type EventTagFilterPanelProps = {
	tags: EventTag[];
	selectedTagId: string | null;
	filtersExpanded: boolean;
	onToggleExpand: () => void;
	onExpand: () => void;
	onSelectTag: (tagId: string) => void;
	onClearSelection: () => void;
	onRetry: () => void;
	isLoading: boolean;
	error: string | null;
	theme: ThemeName;
};

const EventTagFilterPanel = ({
	tags,
	selectedTagId,
	filtersExpanded,
	onToggleExpand,
	onExpand,
	onSelectTag,
	onClearSelection,
	onRetry,
	isLoading,
	error,
	theme,
}: EventTagFilterPanelProps) => {
	const palette = Colors[theme];
	const highlightColor = theme === 'light' ? '#f5a524' : '#f6c15b';
	const highlightText = theme === 'light' ? '#1e1202' : '#120900';
	const inactiveBackground = theme === 'light' ? '#f8fafc' : '#1e242d';
	const inactiveBorder = theme === 'light' ? '#dce2ec' : '#2c333c';
	const inactiveText = theme === 'light' ? '#475569' : '#c7d0de';
	const orderedTags = useMemo(() => {
		if (!selectedTagId) {
			return tags;
		}
		const prioritized = tags.filter((tag) => tag.id === selectedTagId);
		const remaining = tags.filter((tag) => tag.id !== selectedTagId);
		return [...prioritized, ...remaining];
	}, [tags, selectedTagId]);
	const hasHiddenTags = tags.length > TAG_PREVIEW_COUNT;
	const showChips = !isLoading && !error && tags.length > 0;
	const displayTags = filtersExpanded || !hasHiddenTags ? orderedTags : orderedTags.slice(0, TAG_PREVIEW_COUNT);

	const handleChipPress = (tagId: string) => {
		if (hasHiddenTags && !filtersExpanded) {
			onExpand();
		}
		onSelectTag(tagId);
	};

	if (!showChips && !isLoading && !error) {
		return null;
	}

	return (
		<View
			style={[
				styles.filterSection,
				theme === 'light' ? styles.filterSectionLight : styles.filterSectionDark,
			]}
		>
			<View style={styles.filterHeaderRow}>
				<Text style={[styles.filterTitle, { color: palette.text }]}>Filters</Text>
				{selectedTagId ? (
					<TouchableOpacity
						onPress={onClearSelection}
						style={[styles.clearFilterButton, { borderColor: highlightColor }]}
						accessibilityRole="button"
					>
						<Text style={[styles.clearFilterText, { color: highlightColor }]}>Clear</Text>
					</TouchableOpacity>
				) : null}
			</View>
			{isLoading ? (
				<View style={styles.filterStateRow}>
					<ActivityIndicator size="small" color={highlightColor} />
					<Text style={[styles.filterStateText, { color: palette.text }]}>Loading tags...</Text>
				</View>
			) : error ? (
				<View style={styles.filterStateColumn}>
					<Text style={[styles.filterStateErrorText, { color: palette.text }]}>{error}</Text>
					<TouchableOpacity
						onPress={onRetry}
						style={[styles.filterStateRetryButton, { borderColor: highlightColor }]}
						activeOpacity={0.85}
					>
						<Text style={[styles.filterStateRetryText, { color: highlightColor }]}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<>
					<View style={styles.filterChipContainer}>
						{displayTags.map((tag) => {
							const isActive = tag.id === selectedTagId;
							return (
								<TouchableOpacity
									key={tag.id}
									onPress={() => handleChipPress(tag.id)}
									activeOpacity={0.85}
									style={[
										styles.filterChip,
										isActive
											? [
												styles.filterChipActive,
												{ backgroundColor: highlightColor, borderColor: highlightColor },
										  ]
										: [
											styles.filterChipInactive,
											{ backgroundColor: inactiveBackground, borderColor: inactiveBorder },
										  ],
									]}
									accessibilityState={{ selected: isActive }}
								>
									<Text
										style={[styles.filterChipText, { color: isActive ? highlightText : inactiveText }]}
										numberOfLines={1}
									>
										{tag.name}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>
					{hasHiddenTags ? (
						<TouchableOpacity
							onPress={onToggleExpand}
							style={styles.filterToggleRow}
							accessibilityRole="button"
							activeOpacity={0.8}
						>
							<Text style={[styles.filterToggleLabel, { color: highlightColor }]}>
								{filtersExpanded ? 'Hide tags' : `Show all (${tags.length})`}
							</Text>
							<MaterialIcons
								name={filtersExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
								size={20}
								color={highlightColor}
							/>
						</TouchableOpacity>
					) : null}
				</>
			)}
		</View>
	);
};

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
	const initialSelectedTagId = initialTagIdsFromParams[0] ?? null;

	const [events, setEvents] = useState<EventInstance[]>([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isPaginating, setIsPaginating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTagId, setSelectedTagId] = useState<string | null>(initialSelectedTagId);
	const [availableTags, setAvailableTags] = useState<EventTag[]>([]);
	const [areTagsLoading, setAreTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string | null>(null);
	const [filtersExpanded, setFiltersExpanded] = useState(false);
	const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_RADIUS_MILES);
	const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

	useEffect(() => {
		setSelectedTagId(initialTagIdsFromParams[0] ?? null);
	}, [initialTagIdsFromParams]);

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

	const hasExpandableFilters = availableTags.length > TAG_PREVIEW_COUNT;

	useEffect(() => {
		if (!hasExpandableFilters && filtersExpanded) {
			setFiltersExpanded(false);
		}
	}, [filtersExpanded, hasExpandableFilters]);

	const handleSelectTag = useCallback((tagId: string) => {
		setSelectedTagId((previous) => (previous === tagId ? null : tagId));
	}, []);

	const handleClearTags = useCallback(() => {
		setSelectedTagId(null);
	}, []);

	const handleToggleFilterDropdown = useCallback(() => {
		setFiltersExpanded((previous) => !previous);
	}, []);

	const handleExpandFilters = useCallback(() => {
		setFiltersExpanded(true);
	}, []);

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

	const handleRadiusChange = useCallback((nextRadius: number) => {
		setSearchRadius(Math.max(1, nextRadius));
	}, []);

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

				if (selectedTagId) {
					queryParams.event_tag_id = selectedTagId;
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
		[userCoords, searchRadius, selectedTagId]
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

	const renderHeader = useMemo(
		() => (
			<View
				style={[
					styles.listHeader,
					{ backgroundColor: tokens.headerBackground, borderBottomColor: tokens.headerBorder },
				]}
			>
				<Text style={[styles.screenTitle, { color: tokens.headingText }]}>Upcoming events</Text>

				<RadiusSelector value={searchRadius} onChange={handleRadiusChange} theme={theme} />

				<EventTagFilterPanel
					tags={availableTags}
					selectedTagId={selectedTagId}
					filtersExpanded={filtersExpanded}
					onToggleExpand={handleToggleFilterDropdown}
					onExpand={handleExpandFilters}
					onSelectTag={handleSelectTag}
					onClearSelection={handleClearTags}
					onRetry={fetchAvailableTags}
					isLoading={areTagsLoading}
					error={tagsError}
					theme={theme}
				/>

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
		),
		[
			areTagsLoading,
			availableTags,
			error,
			fetchAvailableTags,
			filtersExpanded,
			handleClearTags,
			handleExpandFilters,
			handleRadiusChange,
			handleRetry,
			handleSelectTag,
			handleToggleFilterDropdown,
			searchRadius,
			selectedTagId,
			tagsError,
			theme,
			tokens,
		]
	);

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
		<View style={[styles.container, { backgroundColor: tokens.pageBackground }]}>
			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				renderSectionHeader={({ section }) => (
					<View style={[styles.sectionHeader, { backgroundColor: tokens.pageBackground }]}>
						<View
							style={[
								styles.sectionHeaderPill,
								{ backgroundColor: tokens.headerBackground, borderColor: tokens.headerBorder },
							]}
						>
							<Text style={[styles.sectionHeaderText, { color: tokens.headingText }]}>
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
						progressBackgroundColor={tokens.headerBackground}
					/>
				}
				showsVerticalScrollIndicator={false}
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
		backgroundColor: '#ffffff',
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
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
	radiusInput: {
		flex: 1,
		fontSize: 15,
		fontWeight: '600',
		paddingVertical: 4,
		minWidth: 80,
	},
	radiusUnitLabel: {
		marginLeft: 6,
		fontSize: 13,
		fontWeight: '600',
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
	eventBarName: {
		marginTop: 4,
		fontSize: 16,
		fontWeight: '600',
		color: '#6b7280',
		letterSpacing: 0.25,
		textTransform: 'none',
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
		color: '#111827',
		marginTop: 2,
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
		color: '#4b5563',
		fontWeight: '600',
	},
	scheduleBlock: {
		marginTop: 16,
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
