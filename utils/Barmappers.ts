// Functions to map raw API data to Bar objects
import type { Bar, BarTag, LooseObject } from '../types';
import { DAY_NAME_INDEX, MILES_PER_KM } from './constants';
import { normalizeTwitterUrl, toNumber } from './helpers';

//Map raw tag data to BarTag type
export const mapToBarTag = (raw: any, index: number): BarTag | null => {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return { id: trimmed, name: trimmed };
  }

  if (typeof raw === 'object') {
    const source = raw as LooseObject;
    const name = source.name ?? source.title ?? source.label ?? source.slug;
    if (!name) {
      return null;
    }

    const id = source.id ?? source.tag_id ?? source.slug ?? `${name}-${index}`;
    return {
      id: String(id),
      name: String(name),
      category: source.category ?? source.type ?? undefined,
    };
  }

  return null;
};

//Coerce various day representations to a numeric index (0-6)
const coerceDayIndex = (value: unknown): number | null => {
  if (typeof value === 'number' && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!Number.isNaN(Number(trimmed))) {
      const numeric = Number(trimmed);
      if (numeric >= 0 && numeric <= 6) {
        return numeric;
      }
    }
    const lookup = DAY_NAME_INDEX[trimmed.toLowerCase() as keyof typeof DAY_NAME_INDEX];
    return typeof lookup === 'number' ? lookup : null;
  }
  return null;
};

//Extract closing time metadata from a schedule record
const extractCloseMetaFromRecord = (
  record?: LooseObject | null
): { closesAt?: string; crossesMidnight?: boolean } | null => {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const closesRaw = record.close_time;
  const closesAt =
    typeof closesRaw === 'string' && closesRaw.trim().length > 0 ? closesRaw.trim() : undefined;
  const crossesMidnight = Boolean(record.crosses_midnight ?? false);
  if (!closesAt && !crossesMidnight) {
    return null;
  }
  return { closesAt, crossesMidnight };
};

//Resolve closing time from various schedule buckets
const resolveClosingFromSchedules = (
  raw: LooseObject
): { closesAt?: string; crossesMidnight?: boolean } | null => {
  const scheduleBuckets = [raw.hours];
  const today = new Date().getDay();
  
  for (const bucket of scheduleBuckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }
    for (const entry of bucket) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as LooseObject;
      const entryDay = coerceDayIndex(
        record.day_of_week ??
          record.dayOfWeek ??
          record.day ??
          record.dayName ??
          record.weekday ??
          record.weekDay ??
          record.name
      );
      if (entryDay !== today) {
        continue;
      }
      const meta = extractCloseMetaFromRecord(record);
      if (meta) {
        return meta;
      }
    }
  }
  return null;
};

/**
 * Extract today's closing time metadata from raw bar data
 */
const extractTodayClosingMeta = (
  raw: LooseObject
): { closesAt?: string; crossesMidnight?: boolean } => {
  // Prefer schedule-based resolution from the hours array
  const scheduleMeta = resolveClosingFromSchedules(raw);
  if (scheduleMeta) {
    return scheduleMeta;
  }

  // Fallback: direct close_time field if provided
  const closesAt =
    typeof raw.close_time === 'string' && raw.close_time.trim().length > 0
      ? raw.close_time.trim()
      : undefined;
  const crosses =
    raw.crosses_midnight_today ??
    raw.crossesMidnightToday ??
    raw.crosses_midnight ??
    raw.crossesMidnight;
  const crossesMidnight = typeof crosses === 'boolean' ? crosses : undefined;

  return {
    closesAt,
    crossesMidnight,
  };
};

// Map raw bar data to Bar type
export const mapToBar = (raw: LooseObject, index: number): Bar => {
  const idSource =
    raw.id ?? raw.bar_id ?? raw.uuid ?? raw.slug ?? raw.external_id ?? `bar-${index}`;

  const location = (raw.address ?? raw.location ?? {}) as LooseObject;
  const city = raw.address_city ?? raw.city ?? location.city;
  const state = raw.address_state ?? raw.state ?? location.state;
  const cityState = [city, state].filter(Boolean).join(', ');
  const addressLabel = cityState || city || state || undefined;
  
  const distanceKm = toNumber(raw.distance_km ?? raw.distanceKm ?? raw.distance);
  const distanceMilesExplicit = toNumber(
    raw.distance_miles ?? raw.distanceMiles ?? raw.distance_mi ?? raw.distanceMi ?? raw.distanceMilesAway
  );
  const distanceMiles =
    typeof distanceMilesExplicit === 'number'
      ? distanceMilesExplicit
      : typeof distanceKm === 'number'
        ? distanceKm * MILES_PER_KM
        : undefined;

  const rawTags = Array.isArray(raw.tags)
    ? raw.tags
    : Array.isArray(raw.tag_list)
      ? raw.tag_list
      : [];

  const dedupedTags: BarTag[] = [];
  rawTags
    .map((tag, tagIndex) => mapToBarTag(tag, tagIndex))
    .filter((tag): tag is BarTag => Boolean(tag))
    .forEach((tag) => {
      if (!dedupedTags.some((existing) => existing.id === tag.id)) {
        dedupedTags.push(tag);
      }
    });

  const closingMeta = extractTodayClosingMeta(raw);
  const closesToday = closingMeta.closesAt;
  const crossesMidnightToday = Boolean(
    raw.crosses_midnight_today ??
      raw.crossesMidnightToday ??
      closingMeta.crossesMidnight ??
      false
  );

  return {
    id: String(idSource),
    name: raw.name ?? raw.title ?? 'Unnamed bar',
    city: city ? String(city) : undefined,
    state: state ? String(state) : undefined,
    addressLabel,
    instagram: raw.instagram ?? undefined,
    facebook: raw.facebook ?? undefined,
    twitter: normalizeTwitterUrl(raw.twitter),
    distanceKm,
    distanceMiles,
    closesToday,
    crossesMidnightToday,
    tags: dedupedTags,
  };
};

// Map raw bar items to Bar objects in small batches to keep the UI thread responsive
export const mapBarsInBatches = async (
  items: LooseObject[],
  startIndex = 0,
  batchSize = 40
): Promise<Bar[]> => {
  const mapped: Bar[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    slice.forEach((item, offset) => {
      mapped.push(mapToBar(item, startIndex + i + offset));
    });

    // Yield to the event loop between batches to avoid blocking rendering
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return mapped;
};

//Merge bar lists while preserving order and deduping by id

export const mergeBars = (current: Bar[], incoming: Bar[], replace = false): Bar[] => {
  if (replace || current.length === 0) {
    return incoming;
  }

  const next = [...current];
  incoming.forEach((bar) => {
    const index = next.findIndex((item) => item.id === bar.id);
    if (index === -1) {
      next.push(bar);
    } else {
      next[index] = bar;
    }
  });

  return next;
};