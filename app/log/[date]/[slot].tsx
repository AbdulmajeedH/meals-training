import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { formatDayAr } from '@/lib/date';
import { sum } from '@/lib/macros';
import { n } from '@/lib/num';
import { isMealSlot, SLOT_LABEL_AR, type MealSlot } from '@/lib/slots';
import {
  changeMeal,
  confirmMeal,
  getDayLog,
  listFoods,
  resetMeal,
  skipMeal,
} from '@/queries/meals';
import { programDayForDate } from '@/queries/training';
import { radius, space, useColors } from '@/theme';

/**
 * The exception path: the day a meal was not what the plan said.
 *
 * Reached from the `⋯` on a meal card, never from the main flow — confirming
 * stays one tap on the card itself.
 */
export default function MealLogScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ date: string; slot: string }>();

  const date = params.date;
  const slot = isMealSlot(params.slot) ? params.slot : null;

  const [edits, setEdits] = useState<Map<number, number> | null>(null);

  const data = useDbQuery(() => {
    if (!date || !slot) return null;
    const day = getDayLog(date, programDayForDate(date) != null);
    return { day, entry: day.slots.find((s) => s.slot === slot) ?? null, foods: listFoods() };
  }, [date, slot]);

  if (!date || !slot || !data) {
    return (
      <Screen title="غير موجود">
        <Text color="textDim">هذه الوجبة غير معروفة.</Text>
      </Screen>
    );
  }

  const { entry, foods } = data;
  const mealId = entry?.plannedMeal?.id ?? null;

  // Start editing from whatever currently counts for the slot.
  const current =
    edits ??
    new Map<number, number>(entry?.actual.map((portion) => [portion.food.id, portion.servings]));

  const editedMacros = sum(
    [...current.entries()].flatMap(([foodId, servings]) => {
      const food = foods.find((f) => f.id === foodId);
      return food
        ? [{ macros: { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG }, servings }]
        : [];
    }),
  );

  const setServings = (foodId: number, servings: number) => {
    const next = new Map(current);
    if (servings <= 0) next.delete(foodId);
    else next.set(foodId, servings);
    setEdits(next);
  };

  const saveChanges = () => {
    changeMeal(
      date,
      slot as MealSlot,
      mealId,
      [...current.entries()].map(([foodId, servings]) => ({ foodId, servings })),
    );
    router.back();
  };

  return (
    <Screen
      title={SLOT_LABEL_AR[slot]}
      subtitle={formatDayAr(date)}
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.xl }}>
        <Card>
          <View style={{ gap: space.sm }}>
            <Text variant="heading">{entry?.plannedMeal?.nameAr ?? 'بدون وجبة مخطّطة'}</Text>
            <Text variant="caption" color="textDim">
              {`${n(editedMacros.kcal)} سعرة · ${n(editedMacros.proteinG)} بروتين · ${n(
                editedMacros.carbsG,
              )} كارب · ${n(editedMacros.fatG)} دهون`}
            </Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            title="أكّد كما هو"
            style={{ flex: 1 }}
            onPress={() => {
              confirmMeal(date, slot as MealSlot, mealId);
              router.back();
            }}
          />
          <Button
            title="تخطّيت"
            variant="secondary"
            onPress={() => {
              skipMeal(date, slot as MealSlot, mealId);
              router.back();
            }}
          />
        </View>

        <View style={{ gap: space.md }}>
          <Text variant="heading">ما أكلته فعلاً</Text>
          <Text variant="caption" color="textDim">
            عدّل الحصص فقط إذا اختلف الواقع عن الخطة.
          </Text>

          {foods.length === 0 ? (
            <Card>
              <Text variant="caption" color="textDim">
                لا توجد أطعمة في المكتبة بعد.
              </Text>
            </Card>
          ) : (
            foods.map((food) => {
              const servings = current.get(food.id) ?? 0;
              const active = servings > 0;
              return (
                <Card key={food.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: space.md,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body" color={active ? 'text' : 'textDim'} numberOfLines={1}>
                        {food.nameAr}
                      </Text>
                      <Text variant="caption" color="textFaint">
                        {`${food.servingLabel} · ${n(food.kcal)} سعرة`}
                      </Text>
                    </View>
                    <Stepper
                      value={servings}
                      step={0.5}
                      min={0}
                      decimals={1}
                      onChange={(value) => setServings(food.id, value)}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        <View style={{ gap: space.md }}>
          <Button title="احفظ كوجبة معدّلة" onPress={saveChanges} variant="secondary" />
          <PressableScale
            haptic="light"
            onPress={() => {
              resetMeal(date, slot as MealSlot);
              setEdits(null);
            }}
          >
            <View
              style={{
                paddingVertical: space.md,
                alignItems: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text variant="label" color="textDim">
                أرجِعها إلى الخطة
              </Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}
