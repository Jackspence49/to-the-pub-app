
import { Colors } from '@/constants/theme';
import React from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';



export function LogoHeader() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  return (
    <View style={[styles.container, { backgroundColor: palette.container }]}>
      <Image source={require('../assets/images/headerLogo.png')} style={styles.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="To The Pub" />
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
    width: 150,
    height: 55
  },
});
