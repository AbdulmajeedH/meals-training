import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PRESS_SCALE, spring } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'light' | 'medium' | 'success' | 'none';

const HAPTIC: Record<Exclude<HapticKind, 'none'>, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

type Props = {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Fires on press-IN, together with the scale. Never on release. */
  haptic?: HapticKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  children: ReactNode;
};

/**
 * The app's only touchable.
 *
 * Two design rules are enforced here so no screen has to remember them:
 * feedback fires on press-IN rather than on release (waiting for the finger to
 * lift is the latency the user actually feels), and the scale animates with a
 * critically damped spring, which is interruptible — tapping again mid-release
 * picks up from wherever the scale currently is instead of restarting.
 */
export function PressableScale({
  onPress,
  onLongPress,
  haptic = 'light',
  disabled = false,
  style,
  hitSlop = 8,
  accessibilityLabel,
  children,
}: Props) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : scale.value }],
    opacity: reduceMotion && scale.value < 1 ? 0.6 : 1,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withSpring(PRESS_SCALE, spring.press);
        if (haptic !== 'none') HAPTIC[haptic]().catch(() => {});
      }}
      onPressOut={() => {
        scale.value = withSpring(1, spring.press);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[style, animatedStyle, disabled ? { opacity: 0.4 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
