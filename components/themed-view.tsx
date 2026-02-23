import { Colors } from '@/constants/theme';
import { View, useColorScheme, type ViewProps } from 'react-native';


export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];

  return <View style={[{ backgroundColor: palette.background }, style]} {...otherProps} />;
}
