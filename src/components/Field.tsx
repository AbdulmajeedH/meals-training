import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { font, radius, space, type as typeScale, useColors } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  /** Numeric fields stay left-to-right even inside the RTL layout. */
  numeric?: boolean;
};

export function Field({ label, numeric, style, ...rest }: Props) {
  const colors = useColors();

  return (
    <View style={{ gap: space.xs, flex: 1 }}>
      {label ? (
        <Text variant="caption" color="textFaint">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        {...rest}
        style={[
          typeScale.body,
          {
            fontFamily: font.regular,
            color: colors.text,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
            textAlign: numeric ? 'center' : 'right',
            writingDirection: numeric ? 'ltr' : 'rtl',
          },
          style,
        ]}
      />
    </View>
  );
}
