import { useColorScheme } from 'react-native';

import { palettes, type Colors, type Scheme } from './colors';

export { palettes, dark, light } from './colors';
export type { Colors, Scheme } from './colors';
export { space, radius } from './space';
export { type, font } from './type';
export type { TypeToken } from './type';
export * from './motion';

/** Dark by default: an unset or unknown scheme resolves to dark, not light. */
export function useScheme(): Scheme {
  return useColorScheme() === 'light' ? 'light' : 'dark';
}

export function useColors(): Colors {
  return palettes[useScheme()];
}
