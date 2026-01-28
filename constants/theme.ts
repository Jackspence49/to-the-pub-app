/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    // layout
    container: '#FFFFFF',
    border: '#EEEEEE',
    icon: '#757575',
    iconSelected: '#1976D2',
    activePill: '#E3F2FD',

    //Filters
    filterContainer: '#E0E0E0',
    filterText: '#212121',
    filterTextActive: '#FFFFFF',
    filterActivePill: '#1976D2',

 //Index
    background: '#F5F5F5',
    cardSurface: '#FFFFFF',
    cardTitle: '#212121',
    cardSubtitle: '#757575',
    cardText: '#757575',
    pillBackground: '#F5F5F5',
    pillText: '#1976D2',
    pillBorder: '#1976D2',

      //Warning
  warningBackground: '#FFF8E1',
  warningBorder: '#FFC107',
  warningText: '#424242',
  actionButton: '#1976D2',
  dismissButton: '#757575',

    //Network Error
  networkErrorBackground: '#FDECEA',
  networkErrorButton: '#1976D2',
  networkErrorBorder: '#D32F2F',
  networkErrorText: '#B71C1C',

    text: '#11181C',
    tint: tintColorLight,
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    // layout
    container: '#1E1E1E',
    border: '#333333',
    icon: '#9E9E9E',
    iconSelected: '#42A5F5',
    activePill: '#1A2733',

     //Filters
    filterContainer: '#333333',
    filterText: '#BDBDBD',
    filterTextActive: '#121212',
    filterActivePill: '#42A5F5',

    //Index
    background: '#121212',
    cardSurface: '#1E1E1E',
    cardTitle: '#F5F5F5',
    cardSubtitle: '#BDBDBD',
    cardText: '#BDBDBD',
    pillBackground: '#2C2C2C',
    pillText: '#42A5F5',
    pillBorder: '#42A5F5',

  //Warning
  warningBackground: '#2C261A',
  warningBorder: '#FFC107',
  warningText: '#FFD54F',
  actionButton: '#42A5F5',
  dismissButton: '#BDBDBD',

  //Network Error
  networkErrorBackground: '#1E1E1E',
  networkErrorButton: '#42A5F5',
  networkErrorBorder: '#FF5252',
  networkErrorText: '#F5F5F5',


    text: '#F5F5F5',
    tint: tintColorDark,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
