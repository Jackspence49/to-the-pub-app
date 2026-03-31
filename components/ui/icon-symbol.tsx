import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 */

const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  calendar: 'event',
  'map.fill': 'map',
  magnifyingglass: 'search',
  beerglass: 'sports-bar',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that renders Material Icons.
 * Icon `name`s use SF Symbols naming — add new entries to MAPPING above.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
