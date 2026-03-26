import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View, useColorScheme } from 'react-native';

import BarDetails from '@/components/barDetails';
import { Colors } from '@/constants/theme';
import { Bar, BarHours, BarTag } from '@/types';

type LooseObject = Record<string, any>;

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

const ensureProtocol = (value: string) => (value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);

const normalizeTwitterUrl = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:www\.)?(?:twitter\.com|x\.com)(?:\/|$)/i.test(trimmed)) return ensureProtocol(trimmed);
  const handle = trimmed.replace(/^@/, '');
  if (!handle) return undefined;
  return `https://x.com/${handle}`;
};

const mapToBarTag = (raw: LooseObject, index: number): BarTag | null => {
  if (!raw) return null;
  if (typeof raw === 'string') return { id: raw, name: raw };
  const name = raw.name ?? raw.title ?? raw.label ?? raw.slug;
  if (!name) return null;
  const id = raw.id ?? raw.tag_id ?? raw.slug ?? `${name}-${index}`;
  return { id: String(id), name: String(name), category: raw.category ?? raw.type ?? undefined };
};

const mapToBarHour = (raw: LooseObject): BarHours => ({
  id: String(raw.id ?? ''),
  day_of_week: typeof raw.day_of_week === 'number' ? raw.day_of_week : Number(raw.dayOfWeek ?? 0),
  open_time: raw.open_time ?? raw.openTime ?? '',
  close_time: raw.close_time ?? raw.closeTime ?? '',
  is_closed: Boolean(raw.is_closed ?? raw.isClosed ?? false),
  crosses_midnight: Boolean(raw.crosses_midnight ?? raw.crossesMidnight ?? false),
});

const mapToBar = (raw: LooseObject): Bar => {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag: LooseObject, index: number) => mapToBarTag(tag, index)).filter((tag): tag is BarTag => Boolean(tag))
    : [];
  const hours = Array.isArray(raw.hours)
    ? raw.hours.map((hour: LooseObject) => mapToBarHour(hour)).filter((h) => typeof h.day_of_week === 'number')
    : [];
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? raw.title ?? 'Unnamed bar',
    description: raw.description ?? undefined,
    address_street: raw.address_street ?? raw.street ?? undefined,
    address_city: raw.address_city ?? raw.city ?? undefined,
    address_state: raw.address_state ?? raw.state ?? undefined,
    address_zip: raw.address_zip ?? raw.zip ?? raw.postal_code ?? undefined,
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    phone: raw.phone ?? raw.phone_number ?? undefined,
    website: raw.website ?? raw.site ?? undefined,
    instagram: raw.instagram ?? undefined,
    facebook: raw.facebook ?? undefined,
    twitter: normalizeTwitterUrl(raw.twitter ?? raw.twitter_url ?? raw.x ?? raw.x_url),
    posh: raw.posh ?? undefined,
    eventbrite: raw.eventbrite ?? undefined,
    tags,
    hours,
  };
};

export default function BarDetailScreen() {
  const { barId } = useLocalSearchParams<{ barId?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[(colorScheme ?? 'light') as keyof typeof Colors];
  const [bar, setBar] = useState<Bar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBarDetail = useCallback(async () => {
    if (!barId) {
      setError('Missing bar identifier.');
      setIsLoading(false);
      return;
    }
    if (!normalizedBaseUrl) {
      setError('Set EXPO_PUBLIC_API_URL to load bar details.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setError(null);
      const response = await fetch(`${normalizedBaseUrl}/bars/${barId}?include=hours,tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch bar details (status ${response.status})`);
      }
      const payload = await response.json();
      setBar(mapToBar(payload.data ?? payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bar details right now.');
    } finally {
      setIsLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    fetchBarDetail();
  }, [fetchBarDetail]);

  const handleViewUpcomingEvents = useCallback(() => {
    if (!bar?.id) return;
    router.push({
      pathname: '/bar-events/[barId]',
      params: { barId: bar.id, barName: bar.name },
    });
  }, [bar, router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
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
      <BarDetails
        bar={bar}
        isLoading={isLoading}
        error={error}
        onRetry={fetchBarDetail}
        onViewUpcomingEvents={handleViewUpcomingEvents}
      />
    </View>
  );
}
