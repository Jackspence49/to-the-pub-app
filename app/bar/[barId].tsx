import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { Bar } from '../../types/index';

// Utils
import { mapToBar } from '../../utils/Barmappers';
import { NORMALIZED_BASE_URL } from '../../utils/constants';

// Components
import BarDetails from '../../components/barDetails';

export default function BarDetailScreen() {
  const { barId } = useLocalSearchParams<{ barId?: string }>();
  const router = useRouter();
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  const [bar, setBar] = useState<Bar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!barId) {
      setError('Missing bar identifier.');
      setIsLoading(false);
      return;
    }
    if (!NORMALIZED_BASE_URL) {
      setError('Set EXPO_PUBLIC_API_URL to load bar details.');
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetch(`${NORMALIZED_BASE_URL}/bars/${barId}?include=hours,tags`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch bar details (status ${response.status})`);
        return response.json();
      })
      .then((payload) => {
        const bar = mapToBar(payload.data ?? payload, 0);
        if (!bar) throw new Error('Invalid bar data received from server.');
        setBar(bar);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load bar details right now.');
      })
      .finally(() => {
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [barId, retryCount]);

  const handleRetry = useCallback(() => setRetryCount((c) => c + 1), []);

  const handleViewUpcomingEvents = useCallback(() => {
    if (!bar?.id) return;
    router.push({
      pathname: '/bar-events/[barId]',
      params: { barId: bar.id, barName: bar.name },
    });
  }, [bar, router]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: palette.cardSurface,
          headerShadowVisible: false,
        }}
      />
      <BarDetails
        bar={bar}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        onViewUpcomingEvents={handleViewUpcomingEvents}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
