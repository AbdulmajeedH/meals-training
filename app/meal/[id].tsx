import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { sum } from '@/lib/macros';
import { n } from '@/lib/num';
import { createMeal, getMeal, listFoods, updateMeal } from '@/queries/meals';
import { space } from '@/theme';

export default function MealEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const mealId = isNew ? null : Number(id);

  const { existing, foods } = useDbQuery(
    () => ({ existing: mealId == null ? null : getMeal(mealId), foods: listFoods() }),
    [mealId],
  );

  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '');
  const [servings, setServings] = useState<Map<number, number> | null>(null);

  const current =
    servings ??
    new Map<number, number>(existing?.items.map((item) => [item.food.id, item.servings]));

  const chosen = [...current.entries()].flatMap(([foodId, count]) => {
    const food = foods.find((f) => f.id === foodId);
    return food ? [{ food, servings: count }] : [];
  });

  const macros = sum(
    chosen.map((entry) => ({
      macros: {
        kcal: entry.food.kcal,
        proteinG: entry.food.proteinG,
        carbsG: entry.food.carbsG,
        fatG: entry.food.fatG,
      },
      servings: entry.servings,
    })),
  );

  const setCount = (foodId: number, count: number) => {
    const next = new Map(current);
    if (count <= 0) next.delete(foodId);
    else next.set(foodId, count);
    setServings(next);
  };

  const valid = nameAr.trim().length > 0 && chosen.length > 0;

  return (
    <Screen
      title={isNew ? 'وجبة جديدة' : 'تعديل وجبة'}
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            إلغاء
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.lg }}>
        <Card>
          <View style={{ gap: space.md }}>
            <Field label="اسم الوجبة" value={nameAr} onChangeText={setNameAr} placeholder="مثال: غداء الدجاج والأرز" />
            <Text variant="caption" color="textDim">
              {`${n(macros.kcal)} سعرة · ${n(macros.proteinG)} بروتين · ${n(macros.carbsG)} كارب · ${n(
                macros.fatG,
              )} دهون`}
            </Text>
          </View>
        </Card>

        <Text variant="heading">المكوّنات</Text>

        {foods.length === 0 ? (
          <Card>
            <View style={{ gap: space.md, alignItems: 'center' }}>
              <Text variant="caption" color="textDim" align="center">
                أضف أطعمة أولاً حتى تبني منها وجبة.
              </Text>
              <Button
                title="أضف طعاماً"
                variant="secondary"
                onPress={() => router.push('/food/new' as never)}
              />
            </View>
          </Card>
        ) : (
          foods.map((food) => (
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
                  <Text
                    variant="body"
                    color={current.has(food.id) ? 'text' : 'textDim'}
                    numberOfLines={1}
                  >
                    {food.nameAr}
                  </Text>
                  <Text variant="caption" color="textFaint">
                    {`${food.servingLabel} · ${n(food.kcal)} سعرة`}
                  </Text>
                </View>
                <Stepper
                  value={current.get(food.id) ?? 0}
                  step={0.5}
                  min={0}
                  decimals={1}
                  onChange={(value) => setCount(food.id, value)}
                />
              </View>
            </Card>
          ))
        )}

        <Button
          title="احفظ"
          disabled={!valid}
          onPress={() => {
            const items = chosen.map((entry) => ({
              foodId: entry.food.id,
              servings: entry.servings,
            }));
            if (mealId == null) createMeal(nameAr.trim(), items);
            else updateMeal(mealId, nameAr.trim(), items);
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
