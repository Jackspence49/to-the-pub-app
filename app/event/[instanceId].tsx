import type { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { Event, ThemeName } from '../../types/index';

// Utils
import { mapToEvent } from '../../utils/Eventmappers';
import { EVENTS_ENDPOINT, NORMALIZED_BASE_URL } from '../../utils/constants';
import { ensureProtocol } from '../../utils/helpers';

// Components
import EventDetails from '../../components/eventDetails';

type ActionButton = {
  key: string;
  label: string;
  iconName: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
};

const formatEventDay = (value?: string): string => {
  if (!value) return 'Date coming soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date coming soon';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatEventTime = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const openExternal = async (url?: string) => {
  if (!url) return;
  try {
    await Linking.openURL(ensureProtocol(url));
  } catch (err) {
    console.warn('Unable to open URL', err);
  }
};

const openPhone = async (phone?: string) => {
  if (!phone) return;
  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits) return;
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch (err) {
    console.warn('Unable to open dialer', err);
  }
};

export default function EventDetailScreen() {
  const { instanceId } = useLocalSearchParams<{ instanceId?: string }>();
  const router = useRouter();
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const dateLabel = useMemo(() => formatEventDay(event?.date ?? event?.start_time), [event?.date, event?.start_time]);
  const startTimeLabel = useMemo(() => formatEventTime(event?.start_time), [event?.start_time]);
  const endTimeLabel = useMemo(() => formatEventTime(event?.end_time), [event?.end_time]);

  const addressLabel = useMemo(() => {
    if (!event) return null;
    const parts: string[] = [];
    const street = event.address_street?.trim();
    const cityState = [event.address_city, event.address_state].filter(Boolean).join(', ').trim();
    const cityStateZip = [cityState, event.address_zip?.trim()].filter(Boolean).join(' ').trim();
    if (street) parts.push(street);
    if (cityStateZip) parts.push(cityStateZip);
    return parts.length === 0 ? null : parts.join(', ');
  }, [event]);

  const addressQuery = useMemo(() => {
    if (!event) return null;
    const parts: string[] = [];
    const street = event.address_street?.trim();
    const city = event.address_city?.trim();
    const state = event.address_state?.trim();
    const zip = event.address_zip?.trim();
    if (street) parts.push(street);
    const cityState = [city, state].filter(Boolean).join(', ');
    const cityStateZip = [cityState, zip].filter(Boolean).join(' ');
    if (cityStateZip) parts.push(cityStateZip);
    const query = parts.join(', ').trim();
    return query.length > 0 ? query : null;
  }, [event]);

  const handleOpenMaps = useCallback(async () => {
    if (!addressQuery) return;
    const encoded = encodeURIComponent(addressQuery);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('Unable to open maps', err);
    }
  }, [addressQuery]);

  const fetchEventDetail = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!instanceId) {
      setError('Missing event identifier.');
      setIsLoading(false);
      return;
    }
    if (!NORMALIZED_BASE_URL) {
      setError('Set EXPO_PUBLIC_API_URL to load event details.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setError(null);
      const response = await fetch(`${EVENTS_ENDPOINT}/instances/${instanceId}`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch event details (status ${response.status})`);
      }
      const payload = await response.json();
      setEvent(mapToEvent(payload.data ?? payload));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to load event right now.');
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchEventDetail();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchEventDetail]);

  const actionButtons = useMemo<ActionButton[]>(() => {
    if (!event) return [];
    const buttons: ActionButton[] = [];
    if (event.external_url) {
      buttons.push({
        key: 'external',
        label: 'Event link',
        iconName: 'external-link',
        onPress: () => openExternal(event.external_url),
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
    if (!event?.bar_id) return;
    router.push({
      pathname: '/bar-events/[barId]',
      params: { barId: event.bar_id, barName: event.bar_name ?? '' },
    });
  }, [event, router]);

  const handleViewBarDetails = useCallback(() => {
    if (!event?.bar_id) return;
    router.push({
      pathname: '/bar/[barId]',
      params: { barId: event.bar_id },
    });
  }, [event, router]);

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
      {isLoading && (
        <View style={styles.centerContent}>
          <ActivityIndicator color={palette.activePill} size="large" />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading event...</Text>
        </View>
      )}
      {!isLoading && error && (
        <View style={styles.centerContent}>
          <Text style={[styles.errorTitle, { color: palette.text }]}>Unable to load event</Text>
          <Text style={[styles.errorDescription, { color: palette.cardSubtitle }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: palette.activePill }]} onPress={fetchEventDetail}>
            <Text style={[styles.retryButtonText, { color: palette.activePill }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isLoading && !error && event && (
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
              locationLabel={event.bar_name ?? undefined}
              tagLabel={event.event_tag_name ?? undefined}
              recurrencePattern={undefined}
              addressLabel={addressLabel ?? undefined}
              onPressOpenMap={handleOpenMaps}
              crossesMidnight={event.crosses_midnight}
              onPressLocation={event.bar_id ? handleViewBarDetails : undefined}
              barName={event.bar_name ?? undefined}
              onPressBarDetails={event.bar_id ? handleViewBarDetails : undefined}
              actionButtons={actionButtons}
              onPressViewBarEvents={handleViewBarEvents}
              showActionSection
              barActionsEnabled={Boolean(event.bar_id)}
            />
          </View>
        </ScrollView>
      )}
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
