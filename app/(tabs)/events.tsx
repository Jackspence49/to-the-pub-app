import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
	ActivityIndicator,
	FlatList,
	Image,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

type FetchMode = 'initial' | 'refresh' | 'paginate';

type EventInstance = {
	id: string;
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
};

type EventTag = {
	id: string;
	name: string;
	description?: string;
	slug?: string;
};

type LooseObject = Record<string, any>;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 6;

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
	const idSource =
		raw.id ??
		raw.uuid ??
		raw.instance_id ??
		raw.event_instance_id ??
		raw.event_id ??
		`${raw.name ?? raw.title ?? 'event'}-${raw.start_time ?? raw.starts_at ?? Date.now()}`;

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

	return {
		id: String(idSource),
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

const formatEventDay = (value?: string): string => {
	if (!value) {
		return 'Date coming soon';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Date coming soon';
	}

	return new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	}).format(date);
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

const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

type EventCardProps = { event: EventInstance; availableTags: EventTag[] };
const EventCard = ({ event, availableTags }: EventCardProps) => {
	const barName = event.barName ?? event.venueName ?? 'Bar coming soon';
	const dateLabel = formatEventDay(event.eventDate ?? event.startsAt);
	const startTimeLabel = formatEventTime(event.startsAt);
	const endTimeLabel = formatEventTime(event.endsAt);
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

	return (
		<View style={styles.card}>
			{event.heroImageUrl ? (
				<Image source={{ uri: event.heroImageUrl }} style={styles.cardImage} resizeMode="cover" />
			) : (
				<View style={[styles.cardImage, styles.cardImagePlaceholder]}>
					<Text style={styles.cardImagePlaceholderText}>No image</Text>
				</View>
			)}

			<View style={styles.cardBody}>
				<Text style={styles.eventBarName}>{barName}</Text>
				<Text style={styles.eventTitle}>{event.title}</Text>
				<Text style={styles.eventMeta}>{dateLabel}</Text>

				<View style={styles.timeRow}>
					<View style={styles.timeColumn}>
						<Text style={styles.timeLabel}>Start Time</Text>
						<Text style={styles.timeValue}>{startTimeLabel}</Text>
					</View>
					<View style={[styles.timeColumn, styles.timeColumnRight]}>
						<Text style={styles.timeLabel}>End Time</Text>
						<Text style={styles.timeValue}>{endTimeLabel}</Text>
					</View>
				</View>

				{tagsToRender.length > 0 ? (
					<View style={styles.tagRow}>
						{tagsToRender.map((tag, index) => (
							<View key={`${event.id}-tag-${index}`} style={styles.tagPill}>
								<Text style={styles.tagText}>{tag}</Text>
							</View>
						))}
					</View>
				) : null}
			</View>
		</View>
	);
};

const EventsScreen = () => {
	const searchParams = useLocalSearchParams<{ eventTagId?: string | string[] }>();
	const initialTagIdsFromParams = useMemo(
		() => normalizeTagParamList(searchParams.eventTagId),
		[searchParams.eventTagId]
	);

	const [events, setEvents] = useState<EventInstance[]>([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isPaginating, setIsPaginating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTagIdsFromParams);
	const [availableTags, setAvailableTags] = useState<EventTag[]>([]);
	const [areTagsLoading, setAreTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string | null>(null);
	const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);

	useEffect(() => {
		setSelectedTagIds(initialTagIdsFromParams);
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

	const selectedTagDetails = useMemo(
		() =>
			selectedTagIds
				.map((id) => availableTags.find((tag) => tag.id === id))
				.filter((tag): tag is EventTag => Boolean(tag)),
		[availableTags, selectedTagIds]
	);

	const toggleTagSelection = useCallback((tagId: string) => {
		setSelectedTagIds((previous) =>
			previous.includes(tagId)
				? previous.filter((id) => id !== tagId)
				: [...previous, tagId]
		);
	}, []);

	const handleClearTags = useCallback(() => {
		setSelectedTagIds([]);
	}, []);

	const toggleTagPickerVisibility = useCallback(() => {
		setIsTagPickerOpen((previous) => !previous);
	}, []);

	const selectedTagSummaryLabel = useMemo(() => {
		if (selectedTagDetails.length === 0) {
			return 'No tags selected';
		}
		if (selectedTagDetails.length <= 2) {
			return selectedTagDetails.map((tag) => tag.name).join(', ');
		}
		return `${selectedTagDetails.length} tags selected`;
	}, [selectedTagDetails]);

	const helperTagQueryExample = useMemo(() => {
		if (selectedTagIds.length === 0) {
			return '&event_tag_id=TAG_ID (repeat per selection)';
		}
		return selectedTagIds.map((id) => `&event_tag_id=${id}`).join('');
	}, [selectedTagIds]);

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
				const queryParams: Record<string, QueryValue> = {
					upcoming: true,
					limit: PAGE_SIZE,
					page: pageToLoad,
				};

				if (selectedTagIds.length === 1) {
					queryParams.event_tag_id = selectedTagIds[0];
				} else if (selectedTagIds.length > 1) {
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
		[selectedTagIds]
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
		({ item }) => <EventCard event={item} availableTags={availableTags} />,
		[availableTags]
	);

	const renderHeader = useMemo(
		() => (
			<View style={styles.listHeader}>
				<Text style={styles.screenTitle}>Upcoming events</Text>

				<View style={styles.tagSelector}>
					<View style={styles.tagSelectorHeader}>
						<Text style={styles.tagLabel}>Filter by tags</Text>
						{selectedTagIds.length > 0 ? (
							<TouchableOpacity onPress={handleClearTags} style={styles.clearAllButton}>
								<Text style={styles.clearTagButtonText}>Clear all</Text>
							</TouchableOpacity>
						) : null}
					</View>

					<TouchableOpacity
						style={styles.tagSelectorButton}
						onPress={toggleTagPickerVisibility}
						activeOpacity={0.85}
					>
						<Text
							style={[
								styles.tagSelectorButtonText,
								selectedTagDetails.length === 0 && styles.tagSelectorButtonTextMuted,
							]}
							numberOfLines={1}
						>
							{selectedTagSummaryLabel}
						</Text>
						<Text style={styles.tagSelectorButtonCaret}>{isTagPickerOpen ? '▲' : '▼'}</Text>
					</TouchableOpacity>

					{isTagPickerOpen ? (
						<View style={styles.tagDropdownPanel}>
							{areTagsLoading ? (
								<View style={styles.tagDropdownStateRow}>
									<ActivityIndicator size="small" color="#111827" />
									<Text style={styles.tagDropdownStateText}>Loading tags...</Text>
								</View>
							) : tagsError ? (
								<View style={styles.tagDropdownStateColumn}>
									<Text style={styles.tagDropdownErrorText}>{tagsError}</Text>
									<TouchableOpacity style={styles.retryInlineButton} onPress={fetchAvailableTags}>
										<Text style={styles.retryInlineButtonText}>Retry</Text>
									</TouchableOpacity>
								</View>
							) : availableTags.length === 0 ? (
								<View style={styles.tagDropdownStateRow}>
									<Text style={styles.tagDropdownStateText}>No tags available.</Text>
								</View>
							) : (
								<ScrollView style={styles.tagDropdownList} nestedScrollEnabled>
									{availableTags.map((tag) => {
										const isSelected = selectedTagIds.includes(tag.id);
										return (
											<TouchableOpacity
												key={tag.id}
												style={[styles.tagOption, isSelected && styles.tagOptionSelected]}
												onPress={() => toggleTagSelection(tag.id)}
												activeOpacity={0.85}
											>
												<View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
													{isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
												</View>
												<View style={styles.tagOptionTextWrapper}>
													<Text style={styles.tagOptionTitle}>{tag.name}</Text>
													{tag.description ? (
														<Text style={styles.tagOptionDescription} numberOfLines={2}>
															{tag.description}
														</Text>
													) : null}
												</View>
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							)}
						</View>
					) : null}

					{selectedTagDetails.length > 0 ? (
						<View style={styles.selectedTagsRow}>
							{selectedTagDetails.map((tag) => (
								<View key={tag.id} style={styles.selectedTagPill}>
									<Text style={styles.selectedTagText}>{tag.name}</Text>
								</View>
							))}
						</View>
					) : null}
				</View>

				{error ? (
					<View style={styles.errorBanner}>
						<Text style={styles.errorTitle}>Unable to load events</Text>
						<Text style={styles.errorDescription}>{error}</Text>
						<TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
							<Text style={styles.retryButtonText}>Try again</Text>
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
			handleClearTags,
			handleRetry,
			helperTagQueryExample,
			isTagPickerOpen,
			selectedTagDetails,
			selectedTagIds,
			selectedTagSummaryLabel,
			tagsError,
			toggleTagPickerVisibility,
			toggleTagSelection,
		]
	);

	const renderEmpty = useMemo(() => {
		if (isInitialLoading) {
			return (
				<View style={styles.emptyState}>
					<ActivityIndicator color="#111827" size="large" />
					<Text style={styles.emptyStateText}>Loading events...</Text>
				</View>
			);
		}

		if (error) {
			return (
				<View style={styles.emptyState}>
					<Text style={styles.emptyStateTitle}>No events to show</Text>
					<Text style={styles.emptyStateText}>Adjust the filters above and try again.</Text>
				</View>
			);
		}

		return (
			<View style={styles.emptyState}>
				<Text style={styles.emptyStateTitle}>Nothing scheduled yet</Text>
				<Text style={styles.emptyStateText}>
					We could not find upcoming events for the selected tags.
				</Text>
			</View>
		);
	}, [error, isInitialLoading]);

	const renderFooter = useMemo(() => {
		if (isPaginating) {
			return (
				<View style={styles.listFooter}>
					<ActivityIndicator color="#111827" />
				</View>
			);
		}

		if (!hasMore && events.length > 0) {
			return (
				<View style={styles.listFooter}>
					<Text style={styles.footerText}>You have reached the end.</Text>
				</View>
			);
		}

		return null;
	}, [events.length, hasMore, isPaginating]);

	return (
		<View style={styles.container}>
			<FlatList
				data={events}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				contentContainerStyle={events.length === 0 ? styles.listContentEmpty : styles.listContent}
				ListHeaderComponent={renderHeader}
				ListEmptyComponent={renderEmpty}
				ListFooterComponent={renderFooter}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.35}
				refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
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
		paddingTop: 56,
		paddingHorizontal: 20,
		paddingBottom: 12,
		backgroundColor: '#ffffff',
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
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
	tagSelector: {
		marginTop: 20,
	},
	tagSelectorHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	tagLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: '#4b5563',
	},
	clearAllButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: '#d1d5db',
	},
	clearTagButtonText: {
		color: '#111827',
		fontWeight: '600',
		fontSize: 13,
	},
	tagSelectorButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderColor: '#d1d5db',
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: '#ffffff',
	},
	tagSelectorButtonText: {
		flex: 1,
		marginRight: 12,
		fontSize: 15,
		color: '#111827',
		fontWeight: '600',
	},
	tagSelectorButtonTextMuted: {
		color: '#6b7280',
		fontWeight: '500',
	},
	tagSelectorButtonCaret: {
		fontSize: 12,
		color: '#4b5563',
	},
	tagDropdownPanel: {
		marginTop: 10,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		borderRadius: 12,
		backgroundColor: '#ffffff',
		maxHeight: 240,
		overflow: 'hidden',
	},
	tagDropdownStateRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 20,
	},
	tagDropdownStateColumn: {
		paddingHorizontal: 16,
		paddingVertical: 20,
	},
	tagDropdownStateText: {
		marginLeft: 12,
		color: '#4b5563',
	},
	tagDropdownErrorText: {
		color: '#b91c1c',
		fontWeight: '600',
		marginBottom: 12,
	},
	retryInlineButton: {
		alignSelf: 'flex-start',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 999,
		backgroundColor: '#111827',
	},
	retryInlineButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 13,
	},
	tagDropdownList: {
		maxHeight: 240,
	},
	tagOption: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#f3f4f6',
	},
	tagOptionSelected: {
		backgroundColor: '#f0fdf4',
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: '#d1d5db',
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	checkboxChecked: {
		borderColor: '#10b981',
		backgroundColor: '#d1fae5',
	},
	checkboxMark: {
		fontSize: 14,
		fontWeight: '700',
		color: '#065f46',
	},
	tagOptionTextWrapper: {
		flex: 1,
	},
	tagOptionTitle: {
		fontSize: 15,
		fontWeight: '600',
		color: '#111827',
	},
	tagOptionDescription: {
		marginTop: 2,
		color: '#6b7280',
		fontSize: 13,
	},
	selectedTagsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 12,
	},
	selectedTagPill: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
		backgroundColor: '#eef2ff',
		marginRight: 8,
		marginBottom: 8,
	},
	selectedTagText: {
		color: '#3730a3',
		fontWeight: '600',
	},
	selectedTagsHelper: {
		marginTop: 12,
		color: '#6b7280',
	},
	helperText: {
		marginTop: 16,
		color: '#6b7280',
		fontSize: 13,
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
		fontSize: 12,
		fontWeight: '700',
		color: '#6b7280',
		letterSpacing: 0.8,
		textTransform: 'uppercase',
	},
	eventTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#111827',
	},
	eventMeta: {
		marginTop: 6,
		fontSize: 15,
		color: '#4b5563',
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
