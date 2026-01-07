import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
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
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeName = keyof typeof Colors;
type LooseObject = Record<string, any>;

type BarTag = {
  id: string;
  name: string;
  category?: string;
};

type BarHour = {
  dayOfWeek: number;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed: boolean;
  crossesMidnight: boolean;
};

type BarDetail = {
  id: string;
  name: string;
  description?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  latitude?: string;
  longitude?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tags: BarTag[];
  hours: BarHour[];
};

type ContactAction = {
  key: string;
  iconName: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
  accessibilityLabel: string;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ensureProtocol = (value: string) => (value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);

const formatHourToken = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.includes(':') ? value : `${value.padStart(2, '0')}:00`;
  const [hourPart, minutePart] = normalized.split(':');
  const date = new Date();
  date.setHours(Number(hourPart) || 0, Number(minutePart) || 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const buildAddressLabel = (bar?: BarDetail | null) => {
  if (!bar) {
    return null;
  }
  const segments = [bar.addressStreet, [bar.addressCity, bar.addressState].filter(Boolean).join(', '), bar.addressZip]
    .map((segment) => segment?.trim())
    .filter((segment) => segment && segment.length > 0);
  return segments.length > 0 ? segments.join(' ') : null;
};

const mapToBarTag = (raw: LooseObject, index: number): BarTag | null => {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    return { id: raw, name: raw };
  }
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
};

const mapToBarHour = (raw: LooseObject): BarHour => {
  const dayOfWeek = typeof raw.day_of_week === 'number' ? raw.day_of_week : Number(raw.dayOfWeek ?? 0);
  return {
    dayOfWeek: Number.isNaN(dayOfWeek) ? 0 : dayOfWeek,
    openTime: raw.open_time ?? raw.openTime ?? null,
    closeTime: raw.close_time ?? raw.closeTime ?? null,
    isClosed: Boolean(raw.is_closed ?? raw.isClosed ?? false),
    crossesMidnight: Boolean(raw.crosses_midnight ?? raw.crossesMidnight ?? false),
  };
};

const mapToBarDetail = (raw: LooseObject): BarDetail => {
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((tag, index) => mapToBarTag(tag, index))
        .filter((tag): tag is BarTag => Boolean(tag))
    : [];
  const hours = Array.isArray(raw.hours)
    ? raw.hours
        .map((hour) => mapToBarHour(hour))
        .filter((hour) => typeof hour.dayOfWeek === 'number')
    : [];
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? raw.title ?? 'Unnamed bar',
    description: raw.description ?? undefined,
    addressStreet: raw.address_street ?? raw.street ?? undefined,
    addressCity: raw.address_city ?? raw.city ?? undefined,
    addressState: raw.address_state ?? raw.state ?? undefined,
    addressZip: raw.address_zip ?? raw.zip ?? raw.postal_code ?? undefined,
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    phone: raw.phone ?? raw.phone_number ?? undefined,
    website: raw.website ?? raw.site ?? undefined,
    instagram: raw.instagram ?? undefined,
    facebook: raw.facebook ?? undefined,
    tags,
    hours,
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

const openMapsForAddress = async (address?: string) => {
  if (!address) {
    return;
  }
  const encoded = encodeURIComponent(address);
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Unable to open maps', error);
  }
};

export default function BarDetailScreen() {
  const { barId } = useLocalSearchParams<{ barId?: string }>();
  const colorScheme = useColorScheme();
  const theme = (colorScheme ?? 'light') as ThemeName;
  const palette = Colors[theme];
  const [bar, setBar] = useState<BarDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addressLabel = useMemo(() => buildAddressLabel(bar), [bar]);

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
      const detail = mapToBarDetail(payload.data ?? payload);
      setBar(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bar details right now.');
    } finally {
      setIsLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    fetchBarDetail();
  }, [fetchBarDetail]);

  const sortedHours = useMemo(() => {
    if (!bar?.hours?.length) {
      return [];
    }
    return [...bar.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [bar?.hours]);

  const contactActions = useMemo<ContactAction[]>(() => {
    if (!bar) {
      return [];
    }
    const actions: ContactAction[] = [];
    if (bar.website) {
      actions.push({
        key: 'website',
        iconName: 'globe',
        onPress: () => openExternal(bar.website),
        accessibilityLabel: `Open ${bar.name} website`,
      });
    }
    if (bar.instagram) {
      actions.push({
        key: 'instagram',
        iconName: 'instagram',
        onPress: () => openExternal(bar.instagram),
        accessibilityLabel: `Open ${bar.name} Instagram`,
      });
    }
    if (bar.facebook) {
      actions.push({
        key: 'facebook',
        iconName: 'facebook',
        onPress: () => openExternal(bar.facebook),
        accessibilityLabel: `Open ${bar.name} Facebook`,
      });
    }
    if (bar.phone) {
      actions.push({
        key: 'phone',
        iconName: 'phone',
        onPress: () => openPhone(bar.phone),
        accessibilityLabel: `Call ${bar.name}`,
      });
    }
    return actions;
  }, [bar]);

  const content = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator color={palette.tint} size="large" />
          <Text style={[styles.statusText, { color: palette.text }]}>Loading bar details...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.errorTitle, { color: palette.text }]}>Unable to load bar</Text>
          <Text style={[styles.errorDescription, { color: theme === 'light' ? '#4b5563' : '#94a3b8' }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: palette.tint }]} onPress={fetchBarDetail}>
            <Text style={[styles.retryButtonText, { color: palette.tint }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!bar) {
      return null;
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.barName, { color: palette.text }]}>{bar.name}</Text>
          {bar.description ? (
            <Text style={[styles.barDescription, { color: theme === 'light' ? '#4b5563' : '#cbd5f5' }]}>
              {bar.description}
            </Text>
          ) : null}
          {contactActions.length > 0 ? (
            <View style={styles.contactRow}>
              {contactActions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel}
                  style={[
                    styles.contactIconButton,
                    theme === 'light' ? styles.contactIconButtonLight : styles.contactIconButtonDark,
                  ]}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <FontAwesome name={action.iconName} size={18} color={palette.tint} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {addressLabel ? (
          <View style={[styles.card, theme === 'light' ? styles.cardLight : styles.cardDark]}>
            {addressLabel ? (
              <TouchableOpacity onPress={() => openMapsForAddress(addressLabel)} activeOpacity={0.8}>
                <Text style={[styles.cardLabel, { color: theme === 'light' ? '#0f172a' : '#e2e8f0' }]}>Address</Text>
                <Text style={[styles.cardValue, { color: theme === 'light' ? '#475569' : '#cbd5f5' }]}>{addressLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {bar.tags.length > 0 ? (
          <View style={[styles.card, theme === 'light' ? styles.cardLight : styles.cardDark]}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {/* Type tags */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { marginBottom: 6, color: palette.text }]}>Type</Text>
                <View style={styles.tagContainer}>
                  {bar.tags.filter(tag => (tag.category ?? '').toLowerCase() === 'type').map((tag) => (
                    <View
                      key={tag.id}
                      style={[styles.tagPill, { borderColor: palette.tint, backgroundColor: theme === 'light' ? '#f0f9ff' : '#1e293b' }]}
                    >
                      <Text style={[styles.tagText, { color: palette.text }]}>{tag.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {/* Amenity tags */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { marginBottom: 6, color: palette.text }]}>Amenities</Text>
                <View style={styles.tagContainer}>
                  {bar.tags.filter(tag => (tag.category ?? '').toLowerCase() === 'amenity').map((tag) => (
                    <View
                      key={tag.id}
                      style={[styles.tagPill, { borderColor: palette.tint, backgroundColor: theme === 'light' ? '#f0f9ff' : '#1e293b' }]}
                    >
                      <Text style={[styles.tagText, { color: palette.text }]}>{tag.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {sortedHours.length > 0 ? (
          <View style={[styles.card, theme === 'light' ? styles.cardLight : styles.cardDark]}>
            <Text style={[styles.sectionHeading, { color: palette.text }]}>Hours</Text>
            {sortedHours.map((hour) => {
              const dayLabel = DAY_NAMES[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`;
              if (hour.isClosed) {
                return (
                  <View key={dayLabel} style={styles.hourRow}>
                    <Text style={[styles.hourDay, { color: palette.text }]}>{dayLabel}</Text>
                    <Text style={[styles.hourValue, { color: theme === 'light' ? '#94a3b8' : '#94a3b8' }]}>Closed</Text>
                  </View>
                );
              }
              const openLabel = formatHourToken(hour.openTime);
              const closeLabel = formatHourToken(hour.closeTime);
              return (
                <View key={dayLabel} style={styles.hourRow}>
                  <Text style={[styles.hourDay, { color: palette.text }]}>{dayLabel}</Text>
                  <Text style={[styles.hourValue, { color: theme === 'light' ? '#475569' : '#cbd5f5' }]}>
                    {openLabel && closeLabel ? `${openLabel} – ${closeLabel}` : 'Hours coming soon'}
                    {hour.crossesMidnight ? ' *' : ''}
                  </Text>
                </View>
              );
            })}
            {sortedHours.some((hour) => hour.crossesMidnight) ? (
              <Text style={[styles.hourFootnote, { color: theme === 'light' ? '#9ca3af' : '#94a3b8' }]}>* Closes after midnight</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: bar?.name ?? 'Bar Details' }} />
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
  section: {
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactIconButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contactIconButtonLight: {
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#ffffff',
  },
  contactIconButtonDark: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: '#0f172a',
  },
  barName: {
    fontSize: 28,
    fontWeight: '700',
  },
  barDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
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
    backgroundColor: '#1b1f23',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 16,
    marginTop: 4,
  },
  cardRow: {
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagCategory: {
    fontSize: 13,
    marginLeft: 4,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.3)',
  },
  hourDay: {
    fontSize: 15,
    fontWeight: '600',
  },
  hourValue: {
    fontSize: 15,
  },
  hourFootnote: {
    marginTop: 8,
    fontSize: 13,
    fontStyle: 'italic',
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
});
