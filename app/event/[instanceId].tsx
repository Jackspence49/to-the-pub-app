import type { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';


import EventDetails from '@/components/eventDetails';
import { Colors } from '@/constants/theme';

type ThemeName = keyof typeof Colors;
type LooseObject = Record<string, any>;
type ActionButton = {
  key: string;
  label: string;
  iconName: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
};

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
  const recurrenceLabel = useMemo(() => {
    const raw = event?.recurrencePattern?.trim();
    if (!raw) {
      return null;
    }
    const normalized = raw.toLowerCase();
    if (normalized === 'none' || normalized === 'n/a') {
      return null;
    }
    return raw;
  }, [event?.recurrencePattern]);

  const addressLabel = useMemo(() => {
    if (!event) {
      return null;
    }
    const parts: string[] = [];
    const street = event.addressStreet?.trim();
    const cityState = [event.addressCity, event.addressState].filter(Boolean).join(', ').trim();
    const cityStateZip = [cityState, event.addressZip?.trim()].filter(Boolean).join(' ').trim();
    if (street) {
      parts.push(street);
    }
    if (cityStateZip) {
      parts.push(cityStateZip);
    }
    if (parts.length === 0) {
      return null;
    }
    return parts.join(', ');
  }, [event]);

  const addressQuery = useMemo(() => {
    if (!event) {
      return null;
    }
    const parts: string[] = [];
    const street = event.addressStreet?.trim();
    const city = event.addressCity?.trim();
    const state = event.addressState?.trim();
    const zip = event.addressZip?.trim();
    if (street) {
      parts.push(street);
    }
    const cityState = [city, state].filter(Boolean).join(', ');
    const cityStateZip = [cityState, zip].filter(Boolean).join(' ');
    if (cityStateZip) {
      parts.push(cityStateZip);
    }
    const query = parts.join(', ').trim();
    return query.length > 0 ? query : null;
  }, [event]);

  const handleOpenMaps = useCallback(async () => {
    if (!addressQuery) {
      return;
    }
    const encoded = encodeURIComponent(addressQuery);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });
    if (!url) {
      return;
    }
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('Unable to open maps', err);
    }
  }, [addressQuery]);

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

  const actionButtons = useMemo<ActionButton[]>(() => {
    if (!event) {
      return [];
    }
    const buttons: ActionButton[] = [];
    if (event.externalLink) {
      buttons.push({
        key: 'external',
        label: 'Event link',
        iconName: 'external-link',
        onPress: () => openExternal(event.externalLink),
      });
    }
    if (event.website) {
      buttons.push({
        key: 'website',
        label: 'Website',
        iconName: 'globe',
        onPress: () => openExternal(event.website),
      });
    }
    if (event.phone) {
      buttons.push({ key: 'phone', label: 'Call', iconName: 'phone', onPress: () => openPhone(event.phone) });
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

  const content = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator color={palette.activePill} size="large" />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading event...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.errorTitle, { color: palette.text }]}>Unable to load event</Text>
          <Text style={[styles.errorDescription, { color: theme === 'light' ? '#4b5563' : '#94a3b8' }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: palette.activePill }]} onPress={fetchEventDetail}>
            <Text style={[styles.retryButtonText, { color: palette.activePill }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!event) {
      return null;
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bodyContent}>
          <EventDetails
            title={event.title}
            description={event.description}
            dateLabel={dateLabel}
            startTimeLabel={startTimeLabel ?? undefined}
            endTimeLabel={endTimeLabel ?? undefined}
            locationLabel={event.barName ?? undefined}
            tagLabel={event.tagName ?? undefined}
            recurrencePattern={recurrenceLabel ?? undefined}
            addressLabel={addressLabel ?? undefined}
            onPressOpenMap={handleOpenMaps}
            crossesMidnight={event.crossesMidnight}
            onPressLocation={event.barId ? handleViewBarDetails : undefined}
            barName={event.barName ?? undefined}
            onPressBarDetails={event.barId ? handleViewBarDetails : undefined}
            actionButtons={actionButtons}
            onPressViewBarEvents={handleViewBarEvents}
            showActionSection
            barActionsEnabled={Boolean(event.barId)}
          />
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        }}
      />
      {content()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
  bodyContent: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 20,
  },
});
