import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { space, useColors } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Right-hand accessory in the header row — one primary action per screen. */
  action?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  children: ReactNode;
};

/**
 * Shared page frame: safe-area padding, the screen title, and a single optional
 * action. Generous spacing and one primary action per screen are design rules,
 * so they live here rather than being re-decided per screen.
 */
export function Screen({ title, subtitle, action, scroll = true, contentStyle, children }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={{ marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">{title}</Text>
        {action}
      </View>
      {subtitle ? (
        <Text variant="label" color="textDim" style={{ marginTop: space.xs }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const padding: ViewStyle = {
    paddingTop: insets.top + space.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }, padding, contentStyle]}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {header}
      {children}
    </ScrollView>
  );
}
