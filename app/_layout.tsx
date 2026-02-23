import { Colors } from '@/constants/theme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/hooks/use-auth';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];

  return (
    <AuthProvider>
      <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="bar/[barId]" options={{ title: 'Bar Details' }} />
          <Stack.Screen name="event/[instanceId]" options={{ title: 'Event Details' }} />
          <Stack.Screen name="bar-events/[barId]" options={{ title: 'Bar Events' }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      </ThemeProvider>
    </AuthProvider>
  );
}
