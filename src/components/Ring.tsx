import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from './Text';
import { n } from '@/lib/num';
import { spring, useColors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0–1, may exceed 1 when over target. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  /** Big number in the middle. */
  value: number;
  unit?: string;
  label: string;
};

/**
 * A macro ring. The arc animates with a critically damped spring — a number
 * that overshoots its target reads as wrong, so this never bounces.
 *
 * Going over target fills the ring completely and recolours it rather than
 * wrapping around, because a second lap is ambiguous at a glance.
 */
export function Ring({
  progress,
  size = 132,
  strokeWidth = 12,
  color,
  value,
  unit,
  label,
}: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const clamped = Math.min(1, Math.max(0, progress));
  const over = progress > 1.0001;

  const animated = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    animated.value = reduceMotion ? clamped : withSpring(clamped, spring.value);
  }, [clamped, reduceMotion, animated]);

  const offset = useDerivedValue(() => circumference * (1 - animated.value));

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
        // Start the arc at 12 o'clock. Negative scaleX mirrors it so it grows
        // anticlockwise, matching the right-to-left reading direction.
        transform={[{ rotate: '-90deg' }, { scaleX: -1 }]}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? colors.warn : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>

      <View style={{ alignItems: 'center' }}>
        <Text variant="metric">{n(value)}</Text>
        {unit ? (
          <Text variant="caption" color="textDim">
            {unit}
          </Text>
        ) : null}
        <Text variant="label" color="textDim" style={{ marginTop: 2 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
