import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { clock } from '@/lib/num';
import { remainingSeconds, useRestTimer } from '@/stores/restTimer';
import { radius, space, spring, useColors } from '@/theme';

/**
 * Floating rest countdown. Appears only while a timer is running — no
 * decorative presence, and no artificial delay before it shows.
 */
export function RestTimer() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const { endsAt, totalSec, label, extend, stop } = useRestTimer();
  const [remaining, setRemaining] = useState(() => remainingSeconds(endsAt));
  const firedRef = useRef(false);

  const translateY = useSharedValue(120);

  useEffect(() => {
    if (endsAt == null) {
      translateY.value = withSpring(120, spring.sheet);
      return;
    }
    firedRef.current = false;
    translateY.value = withSpring(0, spring.sheet);

    const tick = () => {
      const left = remainingSeconds(endsAt);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduceMotion ? 0 : translateY.value }],
  }));

  if (endsAt == null) return null;

  const elapsed = totalSec > 0 ? 1 - remaining / totalSec : 1;
  const done = remaining <= 0;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          right: space.lg,
          left: space.lg,
          bottom: insets.bottom + space.md,
        },
        animatedStyle,
      ]}
    >
      <Card raised style={{ padding: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text variant="metric" color={done ? 'good' : 'text'}>
            {clock(remaining)}
          </Text>

          <View style={{ flex: 1 }}>
            <Text variant="label" color="textDim" numberOfLines={1}>
              {done ? 'انتهت الراحة' : (label ?? 'راحة')}
            </Text>
            <View
              style={{
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.track,
                marginTop: space.sm,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, elapsed * 100))}%`,
                  backgroundColor: done ? colors.good : colors.accent,
                }}
              />
            </View>
          </View>

          <PressableScale onPress={() => extend(30)} haptic="light" accessibilityLabel="زد ٣٠ ثانية">
            <View
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.track,
              }}
            >
              <Text variant="label">+30</Text>
            </View>
          </PressableScale>

          <PressableScale onPress={stop} haptic="light" accessibilityLabel="أوقف الراحة">
            <View
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.track,
              }}
            >
              <Text variant="label">تخطّي</Text>
            </View>
          </PressableScale>
        </View>
      </Card>
    </Animated.View>
  );
}
