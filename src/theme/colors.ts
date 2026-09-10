/**
 * Dark is the default; light is supported.
 * Kept as two flat maps so components read `c.text` and never branch on scheme.
 */
export type Scheme = 'dark' | 'light';

export type Colors = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  protein: string;
  carbs: string;
  fat: string;
  kcal: string;
  good: string;
  warn: string;
  bad: string;
  track: string;
};

export const dark: Colors = {
  bg: '#0B0B0F',
  surface: '#16161C',
  surfaceRaised: '#1E1E26',
  border: '#2A2A34',
  text: '#F5F5F7',
  textDim: '#9A9AA6',
  textFaint: '#63636E',
  accent: '#4C8DFF',
  protein: '#5AC8FA',
  carbs: '#FFB340',
  fat: '#FF6B6B',
  kcal: '#4C8DFF',
  good: '#32D74B',
  warn: '#FFD60A',
  bad: '#FF453A',
  track: '#26262F',
};

export const light: Colors = {
  bg: '#FBFBFD',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E3E3E8',
  text: '#101014',
  textDim: '#6A6A76',
  textFaint: '#9A9AA6',
  accent: '#0A62E8',
  protein: '#0A84C8',
  carbs: '#C77700',
  fat: '#D93B3B',
  kcal: '#0A62E8',
  good: '#1E9E3A',
  warn: '#B58A00',
  bad: '#D0362B',
  track: '#ECECF1',
};

export const palettes: Record<Scheme, Colors> = { dark, light };
