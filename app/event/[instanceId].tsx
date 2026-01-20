import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeName = keyof typeof Colors;
type LooseObject = Record<string, any>;

type EventDetail = {
  id: string;
  barId?: string;
  title: string;
  description?: string;
  barName?: string;
  heroImageUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
  eventDate?: string;
  recurrencePattern?: string;
  externalLink?: string;
  website?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  tagName?: string;
  crossesMidnight?: boolean;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatEventTime = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const ensureProtocol = (value: string) => (value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);

const mapToEventDetail = (raw: LooseObject): EventDetail => {
  const crossesMidnight = Boolean(raw.crosses_midnight ?? raw.crossesMidnight ?? false);
  const dateSource = raw.date ?? raw.event_date ?? raw.starts_at ?? raw.start ?? undefined;
  const startTimeSource = raw.custom_start_time ?? raw.start_time ?? raw.start_time_formatted;
  const endTimeSource = raw.custom_end_time ?? raw.end_time ?? raw.end_time_formatted;
  const barId = raw.bar_id ?? raw.bar?.id ?? raw.barId ?? undefined;
  const startsAt =
    raw.starts_at ??
    raw.start ??
    combineDateAndTime(dateSource, startTimeSource) ??
    (typeof raw.start === 'string' ? raw.start : undefined);
  const endsAt =
    raw.ends_at ??
    raw.end ??
    combineDateAndTime(dateSource, endTimeSource, { offsetDays: crossesMidnight ? 1 : 0 }) ??
    (typeof raw.end === 'string' ? raw.end : undefined);

  return {
    id: String(
      raw.instance_id ??
        raw.event_instance_id ??
        raw.id ??
        raw.uuid ??
        raw.event_id ??
        `${raw.name ?? raw.title ?? 'event'}-${raw.start_time ?? raw.starts_at ?? Date.now()}`
    ),
    barId: barId ? String(barId) : undefined,
    title: raw.custom_title ?? raw.title ?? raw.name ?? 'Untitled event',
    description: raw.custom_description ?? raw.description ?? raw.summary ?? undefined,
    barName: raw.bar_name ?? raw.bar?.name ?? raw.venue?.name ?? undefined,
    heroImageUrl: raw.custom_image_url ?? raw.image_url ?? raw.hero_image_url ?? raw.banner_url ?? null,
    startsAt,
    endsAt,
    eventDate: raw.date ?? raw.event_date ?? startsAt ?? undefined,
    recurrencePattern: raw.recurrence_pattern ?? undefined,
    externalLink: raw.custom_external_link ?? raw.external_link ?? undefined,
    website: raw.website ?? raw.bar?.website ?? undefined,
    phone: raw.phone ?? raw.bar?.phone ?? undefined,
    addressStreet: raw.address_street ?? raw.bar?.address_street ?? undefined,
    addressCity: raw.address_city ?? raw.bar?.address_city ?? undefined,
    addressState: raw.address_state ?? raw.bar?.address_state ?? undefined,
    addressZip: raw.address_zip ?? raw.bar?.address_zip ?? undefined,
    tagName: raw.tag?.name ?? raw.event_tag?.name ?? raw.tag_name ?? undefined,
    crossesMidnight,
  };
};

const openExternal = async (url?: string) => {
  if (!url) {
    return;
  }
  try {
    await Linking.openURL(ensureProtocol(url));
  } catch (error) {
    console.warn('Unable to open URL', error);
  }
};

const openPhone = async (phone?: string) => {
  if (!phone) {
    return;
  }
  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits) {
    return;
  }
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch (error) {
    console.warn('Unable to open dialer', error);
  }
};

export default function EventDetailScreen() {
  const { instanceId } = useLocalSearchParams<{ instanceId?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = (colorScheme ?? 'light') as ThemeName;
  const palette = Colors[theme];
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = useMemo(() => formatEventDay(event?.eventDate ?? event?.startsAt), [event?.eventDate, event?.startsAt]);
  const startTimeLabel = useMemo(() => formatEventTime(event?.startsAt), [event?.startsAt]);
  const endTimeLabel = useMemo(() => formatEventTime(event?.endsAt), [event?.endsAt]);

  const fetchEventDetail = useCallback(async () => {
    if (!instanceId) {
      setError('Missing event identifier.');
      setIsLoading(false);
      return;
    }
    if (!normalizedBaseUrl) {
      setError('Set EXPO_PUBLIC_API_URL to load event details.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setError(null);
      const response = await fetch(`${normalizedBaseUrl}/events/instances/${instanceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch event details (status ${response.status})`);
      }
      const payload = await response.json();
      const detail = mapToEventDetail(payload.data ?? payload);
      setEvent(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load event right now.');
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchEventDetail();
  }, [fetchEventDetail]);

  const actionButtons = useMemo(() => {
    if (!event) {
      return [];
    }
    const buttons: { key: string; iconName: React.ComponentProps<typeof FontAwesome>['name']; onPress: () => void }[] = [];
    if (event.externalLink) {
      buttons.push({ key: 'external', iconName: 'external-link', onPress: () => openExternal(event.externalLink) });
    }
    if (event.website) {
      buttons.push({ key: 'website', iconName: 'globe', onPress: () => openExternal(event.website) });
    }
    if (event.phone) {
      buttons.push({ key: 'phone', iconName: 'phone', onPress: () => openPhone(event.phone) });
    }
    return buttons;
  }, [event]);

  const handleViewBarEvents = useCallback(() => {
    if (!event?.barId) {
      return;
    }
    router.push({
      pathname: '/bar-events/[barId]',
      params: {
        barId: event.barId,
        barName: event.barName ?? '',
      },
    });
  }, [event, router]);

  const handleViewBarDetails = useCallback(() => {
    if (!event?.barId) {
      return;
    }
    router.push({
      pathname: '/bar/[barId]',
      params: {
        barId: event.barId,
      },
    });
  }, [event, router]);

  const showActionSection = true;

  const content = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator color={palette.tint} size="large" />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading event...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.errorTitle, { color: palette.text }]}>Unable to load event</Text>
          <Text style={[styles.errorDescription, { color: theme === 'light' ? '#4b5563' : '#94a3b8' }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: palette.tint }]} onPress={fetchEventDetail}>
            <Text style={[styles.retryButtonText, { color: palette.tint }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!event) {
      return null;
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {event.heroImageUrl ? (
          <Image source={{ uri: event.heroImageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={[styles.heroPlaceholderText, { color: theme === 'light' ? '#94a3b8' : '#64748b' }]}>Image coming soon</Text>
          </View>
        )}

        <View style={[styles.card, theme === 'light' ? styles.cardLight : styles.cardDark]}>
          {event.tagName ? (
            <View style={[styles.tagPill, { borderColor: palette.tint }]}>
              <Text style={[styles.tagText, { color: palette.tint }]}>{event.tagName}</Text>
            </View>
          ) : null}
          <Text style={[styles.eventTitle, { color: palette.text }]}>{event.title}</Text>
          {event.description ? (
            <Text style={[styles.descriptionText, { color: theme === 'light' ? '#1f2937' : '#f1f5f9' }]}>{event.description}</Text>
          ) : null}
          <View style={styles.barLinkSection}>
            <TouchableOpacity
              onPress={event.barId ? handleViewBarDetails : undefined}
              activeOpacity={event.barId ? 0.85 : 1}
              style={[styles.barLinkButton, { borderColor: palette.tint, opacity: event.barId ? 1 : 0.6 }]}
              disabled={!event.barId}
              accessibilityRole={event.barId ? 'button' : undefined}
              accessibilityLabel={event.barId ? `View ${event.barName ?? 'bar'} details` : undefined}
            >
              <FontAwesome name="map-marker" size={16} color={palette.tint} style={{ marginRight: 8 }} />
              <Text style={[styles.barLinkText, { color: palette.tint }]}>{event.barName ?? 'Bar coming soon'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.timeCard}>
            <Text style={[styles.timeHeading, { color: palette.text }]}>{dateLabel}</Text>
            <Text style={[styles.timeRange, { color: theme === 'light' ? '#334155' : '#e2e8f0' }]}>
              {startTimeLabel && endTimeLabel ? `${startTimeLabel} – ${endTimeLabel}` : startTimeLabel ?? 'Time TBD'}
            </Text>
            {event.recurrencePattern ? (
              <Text style={[styles.recurrenceText, { color: theme === 'light' ? '#6366f1' : '#c7d2fe' }]}>Repeats {event.recurrencePattern}</Text>
            ) : null}
            {event.crossesMidnight ? (
              <Text style={[styles.recurrenceFootnote, { color: theme === 'light' ? '#9ca3af' : '#94a3b8' }]}>Ends after midnight</Text>
            ) : null}
          </View>
        </View>

        {showActionSection ? (
          <View style={styles.actionList}>
            <View style={[styles.iconButtonRow, { borderColor: 'rgba(15, 23, 42, 0.08)' }]}> 
              {actionButtons.map((button) => (
                <TouchableOpacity
                  key={button.key}
                  onPress={button.onPress}
                  style={[styles.iconCircleButton, { borderColor: palette.tint }]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={button.key}
                >
                  <FontAwesome name={button.iconName} size={16} color={palette.tint} />
                </TouchableOpacity>
              ))}
              {event?.barId ? (
                <TouchableOpacity
                  onPress={handleViewBarDetails}
                  style={[styles.iconCircleButton, { borderColor: palette.tint }]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View bar details"
                >
                  <FontAwesome name="info-circle" size={16} color={palette.tint} />
                </TouchableOpacity>
              ) : null}
              {event?.barId ? (
                <TouchableOpacity
                  onPress={handleViewBarEvents}
                  style={[styles.iconCircleButton, styles.iconCircleButtonPrimary]}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="See bar events"
                >
                  <FontAwesome name="calendar" size={16} color="#1f2937" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={handleViewBarEvents}
              style={[styles.fullWidthButton, !event?.barId && styles.fullWidthButtonDisabled]}
              activeOpacity={0.9}
              disabled={!event?.barId}
            >
              <Text style={styles.fullWidthButtonText}>See all upcoming events</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: event?.title ?? 'Event Details', headerBackTitle: 'Back' }} />
      {content()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  statusText: {
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  errorDescription: {
    textAlign: 'center',
    fontSize: 15,
  },
  retryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  heroImage: {
    borderRadius: 24,
    width: '100%',
    height: 240,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  heroPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  eventMeta: {
    fontSize: 15,
  },
  timeCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    gap: 6,
  },
  timeHeading: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeRange: {
    fontSize: 20,
    fontWeight: '700',
  },
  recurrenceText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  recurrenceFootnote: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  barLinkSection: {
    gap: 8,
  },
  barLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  barLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionList: {
    gap: 12,
  },
  iconButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 4,
  },
  iconCircleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconCircleButtonPrimary: {
    backgroundColor: '#fef3c7',
    borderColor: 'rgba(15, 23, 42, 0)',
  },
  fullWidthButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  fullWidthButtonDisabled: {
    opacity: 0.5,
  },
  fullWidthButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
