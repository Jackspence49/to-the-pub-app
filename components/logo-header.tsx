
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import darkLogo from '@/assets/images/dark_logo.png';
import lightLogo from '@/assets/images/light_logo.png';

export function LogoHeader() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={styles.container}>
      <Image
        source={isDark ? lightLogo : darkLogo}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="To The Pub logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logo: {
    height: 150,
    width: 400,
  },
});
