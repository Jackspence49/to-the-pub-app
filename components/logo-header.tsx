
import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';



export function LogoHeader() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  return (
    <View style={[styles.container, { backgroundColor: palette.container }]}>
      <Text style={{ color: palette.cardTitle }}>To The Pub</Text>
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
