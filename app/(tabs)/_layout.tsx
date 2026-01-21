import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { LogoHeader } from '@/components/logo-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function TabLayout() {
  const { status } = useAuth();
  const colorScheme = useColorScheme();
  const background = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');

  if (status === 'checking') {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: background }]}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    );
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        headerShown: true,
        headerTitle: () => <LogoHeader />,
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: background },
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bars',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wineglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
