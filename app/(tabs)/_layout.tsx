import { Colors } from '@/constants/theme';
import { Redirect, Tabs } from 'expo-router'; // Tab layout with authentication check
import React from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';


// Custom components
import { HapticTab } from '@/components/haptic-tab';
import { LogoHeader } from '@/components/logo-header';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Custom hooks for theming and authentication
import { useAuth } from '@/hooks/use-auth';

//Get Auth status and theme colors
export default function TabLayout() {
  const { status } = useAuth();  
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];

  // Show loader while checking auth status
  if (status === 'checking') { 
    return (
      <View style={[styles.loaderContainer, { backgroundColor: palette.container }]}>
        <ActivityIndicator size="large" color={palette.iconSelected} />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  // Render tab navigator if authenticated
  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: palette.iconSelected,
        tabBarInactiveTintColor: palette.icon,
        tabBarActiveBackgroundColor: palette.activePill,
        tabBarStyle: {
          backgroundColor: palette.container,
          borderTopColor: palette.border,
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
          backgroundColor: palette.container,
          height: 120,
          borderBottomColor: palette.border,
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
