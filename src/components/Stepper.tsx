import { View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { d } from '@/lib/num';
import { radius, space, useColors } from '@/theme';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: number;
  label?: string;
};

/**
 * Minus / value / plus. Used for weight and reps, which are the only two numbers
 * ever edited mid-workout — both need to change without opening a keyboard.
 */
export function Stepper({
  value,
  onChange,
  step = 2.5,
  min = 0,
  max = 999,
  suffix,
  decimals = 1,
  label,
}: Props) {
  const colors = useColors();
  const current = value ?? 0;

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, current + delta));
    // Avoid 82.50000000000001 from repeated float addition.
    onChange(Math.round(next * 100) / 100);
  };

  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text variant="caption" color="textFaint">
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Button label="−" onPress={() => bump(-step)} />
        <View style={{ minWidth: 76, alignItems: 'center' }}>
          <Text variant="heading">
            {value == null ? '—' : `${d(value, decimals)}${suffix ? ` ${suffix}` : ''}`}
          </Text>
        </View>
        <Button label="+" onPress={() => bump(step)} />
      </View>
    </View>
  );

  function Button({ label: text, onPress }: { label: string; onPress: () => void }) {
    return (
      <PressableScale onPress={onPress} haptic="light" accessibilityLabel={text}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            backgroundColor: colors.track,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="heading">{text}</Text>
        </View>
      </PressableScale>
    );
  }
}
