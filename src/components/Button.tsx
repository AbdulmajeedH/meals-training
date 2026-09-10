import { View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type HapticKind } from './PressableScale';
import { Text } from './Text';
import { radius, space, useColors } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  haptic?: HapticKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** One primary action per screen, so `primary` should appear at most once. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  haptic = 'light',
  disabled,
  style,
}: Props) {
  const colors = useColors();

  const background =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceRaised : 'transparent';

  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      style={style}
      accessibilityLabel={title}
    >
      <View
        style={{
          backgroundColor: background,
          borderRadius: radius.md,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: variant === 'primary' ? colors.accent : colors.border,
          paddingVertical: space.md + 2,
          paddingHorizontal: space.xl,
          alignItems: 'center',
        }}
      >
        <Text variant="heading" color={variant === 'primary' ? 'bg' : 'text'}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}
