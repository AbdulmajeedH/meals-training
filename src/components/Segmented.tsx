import { View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { radius, space, useColors } from '@/theme';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="light"
            style={{ flex: 1 }}
            accessibilityLabel={option.label}
          >
            <View
              style={{
                paddingVertical: space.sm + 2,
                borderRadius: radius.sm,
                alignItems: 'center',
                backgroundColor: active ? colors.surfaceRaised : 'transparent',
                borderWidth: 1,
                borderColor: active ? colors.border : 'transparent',
              }}
            >
              <Text variant="label" color={active ? 'text' : 'textDim'} numberOfLines={1}>
                {option.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
