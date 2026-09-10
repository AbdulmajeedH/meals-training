import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type as typeScale, useColors, type Colors, type TypeToken } from '@/theme';

type Props = RNTextProps & {
  variant?: TypeToken;
  /** A key from the palette, or any literal colour. Defaults to `text`. */
  color?: keyof Colors | (string & {});
  align?: 'auto' | 'left' | 'right' | 'center';
};

/**
 * Every string in the app goes through here so nothing can accidentally render
 * in the system font — IBM Plex Sans Arabic is the only face we load.
 */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const colors = useColors();
  const resolved = (colors as Record<string, string>)[color as string] ?? (color as string);

  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: resolved },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
