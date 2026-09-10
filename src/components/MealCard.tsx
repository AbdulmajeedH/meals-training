import { View } from 'react-native';

import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { n } from '@/lib/num';
import type { DaySlot } from '@/queries/meals';
import { SLOT_LABEL_AR } from '@/lib/slots';
import { radius, space, useColors } from '@/theme';

type Props = {
  slot: DaySlot;
  onConfirm: () => void;
  onOpen: () => void;
};

const STATUS_LABEL: Record<DaySlot['status'], string> = {
  planned: 'مخطّط',
  confirmed: 'تم',
  changed: 'معدّل',
  skipped: 'متخطّى',
};

/**
 * A planned meal, confirmable in one tap.
 *
 * The whole card is the confirm target; opening the detail view for the rare
 * "reality differed" case is the smaller, secondary action. That asymmetry is
 * the point — the common path must not compete with the exception.
 */
export function MealCard({ slot, onConfirm, onOpen }: Props) {
  const colors = useColors();
  const settled = slot.status === 'confirmed' || slot.status === 'changed';
  const skipped = slot.status === 'skipped';

  const statusColor = settled ? 'good' : skipped ? 'textFaint' : 'textDim';

  return (
    <Card padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <PressableScale
          onPress={onConfirm}
          haptic="light"
          style={{ flex: 1 }}
          accessibilityLabel={`أكّد ${SLOT_LABEL_AR[slot.slot]}`}
        >
          <View style={{ padding: space.lg, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text variant="caption" color="textFaint">
                {SLOT_LABEL_AR[slot.slot]}
              </Text>
              <View
                style={{
                  paddingHorizontal: space.sm,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: settled ? colors.good + '22' : colors.track,
                }}
              >
                <Text variant="caption" color={statusColor}>
                  {STATUS_LABEL[slot.status]}
                </Text>
              </View>
            </View>

            <Text
              variant="heading"
              color={skipped ? 'textFaint' : 'text'}
              numberOfLines={1}
              style={skipped ? { textDecorationLine: 'line-through' } : undefined}
            >
              {slot.plannedMeal?.nameAr ?? 'بدون وجبة'}
            </Text>

            <Text variant="caption" color="textDim">
              {`${n(slot.macros.kcal)} سعرة · ${n(slot.macros.proteinG)} جم بروتين`}
            </Text>
          </View>
        </PressableScale>

        <PressableScale onPress={onOpen} haptic="light" accessibilityLabel="تعديل الوجبة">
          <View
            style={{
              width: 56,
              alignSelf: 'stretch',
              alignItems: 'center',
              justifyContent: 'center',
              borderStartWidth: 1,
              borderStartColor: colors.border,
            }}
          >
            <Text variant="heading" color="textDim">
              ⋯
            </Text>
          </View>
        </PressableScale>
      </View>
    </Card>
  );
}
