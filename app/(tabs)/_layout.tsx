import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { LogoHeader } from '@/components/logo-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function TabLayout() {
  const { status } = useAuth();
  const container = useThemeColor({}, 'container');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const iconSelected = useThemeColor({}, 'iconSelected');
  const activePill = useThemeColor({}, 'activePill');

  if (status === 'checking') {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: container }]}>
        <ActivityIndicator size="large" color={iconSelected} />
      </View>
    );
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: iconSelected,
        tabBarInactiveTintColor: icon,
        tabBarActiveBackgroundColor: activePill,
        tabBarStyle: {
          backgroundColor: container,
          borderTopColor: border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        headerShown: true,
        headerTitle: () => <LogoHeader />,
        headerTitleAlign: 'left',
        headerTitleContainerStyle: {
          alignItems: 'flex-start',
          paddingLeft: 0,
          marginLeft: 0,
        },
        headerStyle: {
          backgroundColor: container,
          height: 120,
          borderBottomColor: border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Open Bars',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="beerglass" color={color} />,
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
