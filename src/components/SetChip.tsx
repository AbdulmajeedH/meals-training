import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { d, n } from '@/lib/num';
import type { SetResult } from '@/lib/progression';
import { radius, space, spring, useColors } from '@/theme';

type Props = {
  set: SetResult;
  onToggle: () => void;
  onEdit: () => void;
};

/**
 * One prescribed set, pre-filled with last session's numbers.
 *
 * Tap confirms it as done — that is the whole logging interaction for a normal
 * set. Long-press is the escape hatch for the day reality differed.
 */
export function SetChip({ set, onToggle, onEdit }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(set.done ? 1 : 0);

  useEffect(() => {
    fill.value = withSpring(set.done ? 1 : 0, spring.press);
  }, [set.done, fill]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = reduceMotion ? (set.done ? 1 : 0) : fill.value;
    return {
      backgroundColor: t > 0.5 ? colors.accent : colors.track,
      borderColor: t > 0.5 ? colors.accent : colors.border,
    };
  });

  const empty = set.weightKg == null && set.reps == null;

  return (
    <PressableScale
      onPress={onToggle}
      onLongPress={onEdit}
      haptic="light"
      accessibilityLabel={`المجموعة ${set.setNo}`}
    >
      <Animated.View
        style={[
          {
            minWidth: 92,
            paddingVertical: space.md,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            borderWidth: 1,
            alignItems: 'center',
            gap: 2,
          },
          animatedStyle,
        ]}
      >
        <Text variant="caption" color={set.done ? 'bg' : 'textFaint'}>
          {n(set.setNo)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="heading" color={set.done ? 'bg' : 'text'}>
            {empty ? '—' : set.weightKg == null ? '؟' : d(set.weightKg)}
          </Text>
          <Text variant="caption" color={set.done ? 'bg' : 'textDim'}>
            ×
          </Text>
          <Text variant="heading" color={set.done ? 'bg' : 'text'}>
            {set.reps == null ? '—' : n(set.reps)}
          </Text>
        </View>
      </Animated.View>
    </PressableScale>
  );
}
