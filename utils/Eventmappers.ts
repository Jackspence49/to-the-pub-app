// Functions to map raw API data to Event objects
import type { Event, EventTag, LooseObject } from '@/types/index';

// Parse a route param (string | string[]) into a deduplicated array of tag IDs
export const parseTagParam = (value?: string | string[]): string[] => {
	if (!value) return [];
	const rawList = Array.isArray(value) ? value : value.split(',');
	return Array.from(new Set(rawList.map((entry) => entry.trim()).filter(Boolean)));
};

// Returns the start of day (midnight) for a given date
const startOfDay = (input: Date): Date => {
	const copy = new Date(input);
	copy.setHours(0, 0, 0, 0);
	return copy;
};

// Format an event date string as a human-readable relative label
export const formatRelativeEventDay = (value?: string): string => {
	if (!value) return 'Date coming soon';

	// Parse date-only strings (YYYY-MM-DD) as local time to avoid UTC midnight off-by-one
	const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return 'Date coming soon';

	const today = startOfDay(new Date());
	const target = startOfDay(date);
	const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Tomorrow';
	if (diffDays > 1 && diffDays <= 6) {
		return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
	}
	return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
};

// Function to extract event items from various API response structures
export const extractEventItems = (payload: unknown): LooseObject[] => {
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
export const extractTagItems = (payload: unknown): LooseObject[] => {
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

// Normalize a date-only string (YYYY-MM-DD) and apply optional day offset
export const normalizeDateOnly = (value?: string, offsetDays = 0): string | null => {
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

// Combine date-only and time-only strings into a full datetime string
export const combineDateAndTime = (
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

// Map raw event data to Event type
export const mapToEvent = (raw: LooseObject): Event => {
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

	const derivedVenueName =
		raw.venue?.name ??
		raw.venue_name ??
		raw.location_name ??
		(typeof raw.venue === 'string' ? raw.venue : undefined);

	const barName = raw.bar_name ?? raw.bar?.name ?? derivedVenueName ?? 'Unknown bar';

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

	const eventTagId =
		raw.event_tag_id ??
		raw.event_tag?.id ??
		raw.event_tag?.slug ??
		raw.tag_id ??
		raw.tag?.id ??
		raw.tag?.slug ??
		undefined;

	const eventTagName =
		raw.event_tag?.name ??
		raw.event_tag_name ??
		raw.tag_name ??
		raw.tag?.name ??
		raw.event_tag ??
		eventTagId ??
		undefined;

	const distanceMiles = (() => {
		const candidates = [raw.distance_miles, raw.distanceMiles, raw.distance];
		const numeric = candidates.find((entry) => typeof entry === 'number');
		return typeof numeric === 'number' ? numeric : undefined;
	})();

	return {
		instance_id: String(primaryId),
		event_id: eventIdSource ? String(eventIdSource) : undefined,
		title: raw.title ?? raw.name ?? 'Untitled event',
		description: raw.description ?? raw.summary ?? raw.subtitle ?? undefined,
		bar_name: barName,
		address_city: city ?? undefined,
		address_state: state ?? undefined,
		start_time: startDateTime ?? raw.begin_at ?? undefined,
		end_time: endDateTime ?? undefined,
		event_tag_name: eventTagName,
		event_tag_id: eventTagId ? String(eventTagId) : undefined,
		date: eventDate ?? startDateTime,
		crosses_midnight: crossesMidnight,
		distanceMiles,
	};
};

// Map raw tag data to EventTag type
export const mapToEventTag = (raw: LooseObject): EventTag => {
	const fallbackId =
		raw.id ??
		raw.tag_id ??
		raw.uuid ??
		raw.name ??
		`tag-${Date.now()}`;

	return {
		id: String(fallbackId),
		name: raw.name ?? raw.title ?? raw.label ?? `Tag ${fallbackId}`,
	};
};

// Merge current and incoming event lists, deduping by instance_id
export const mergeEvents = (current: Event[], incoming: Event[]): Event[] => {
	if (current.length === 0) {
		return incoming;
	}

	const next = [...current];

	incoming.forEach((event) => {
		const index = next.findIndex((item) => item.instance_id === event.instance_id);
		if (index === -1) {
			next.push(event);
		} else {
			next[index] = event;
		}
	});

	return next;
};
