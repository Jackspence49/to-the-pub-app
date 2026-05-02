import { Colors } from '@/constants/theme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/hooks/use-auth';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://3d0ef695ce14c55e07aa5be848c61e79@o4511321331269632.ingest.us.sentry.io/4511321335005184',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default Sentry.wrap(function RootLayout() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];

  return (
    <AuthProvider>
      <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerBackTitle: '' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="bar/[barId]" options={{ title: 'Bar Details' }} />
          <Stack.Screen name="event/[instanceId]" options={{ title: 'Event Details' }} />
          <Stack.Screen name="bar-events/[barId]" options={{ title: 'Bar Events' }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
        </Stack>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </AuthProvider>
  );
});
