import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { kcalFromMacros } from '@/lib/macros';
import { n } from '@/lib/num';
import { archiveFood, deleteFood, listFoods, upsertFood } from '@/queries/meals';
import { space } from '@/theme';

/** `new` creates; any numeric id edits. One screen, because the form is identical. */
export default function FoodEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const foodId = isNew ? null : Number(id);

  const existing = useDbQuery(
    () => (foodId == null ? null : (listFoods(true).find((f) => f.id === foodId) ?? null)),
    [foodId],
  );

  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '');
  const [servingLabel, setServingLabel] = useState(existing?.servingLabel ?? '');
  const [kcal, setKcal] = useState(existing ? String(existing.kcal) : '');
  const [protein, setProtein] = useState(existing ? String(existing.proteinG) : '');
  const [carbs, setCarbs] = useState(existing ? String(existing.carbsG) : '');
  const [fat, setFat] = useState(existing ? String(existing.fatG) : '');

  const parsed = {
    kcal: Number(kcal),
    proteinG: Number(protein),
    carbsG: Number(carbs),
    fatG: Number(fat),
  };

  const valid =
    nameAr.trim().length > 0 &&
    servingLabel.trim().length > 0 &&
    Object.values(parsed).every((value) => Number.isFinite(value) && value >= 0);

  const implied = kcalFromMacros(parsed);
  const mismatch = valid && parsed.kcal > 0 && Math.abs(implied - parsed.kcal) > parsed.kcal * 0.15;

  return (
    <Screen
      title={isNew ? 'طعام جديد' : 'تعديل طعام'}
      subtitle="القيم لكل حصة واحدة"
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
            <Field label="الاسم" value={nameAr} onChangeText={setNameAr} placeholder="مثال: صدر دجاج" />
            <Field
              label="الحصة"
              value={servingLabel}
              onChangeText={setServingLabel}
              placeholder="مثال: 100 جم"
            />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Field label="سعرات" numeric value={kcal} onChangeText={setKcal} />
              <Field label="بروتين" numeric value={protein} onChangeText={setProtein} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Field label="كارب" numeric value={carbs} onChangeText={setCarbs} />
              <Field label="دهون" numeric value={fat} onChangeText={setFat} />
            </View>

            {mismatch ? (
              <Text variant="caption" color="warn">
                {`الماكروز تعطي ${n(implied)} سعرة تقريباً — تأكّد من القيم.`}
              </Text>
            ) : null}
          </View>
        </Card>

        <Button
          title="احفظ"
          disabled={!valid}
          onPress={() => {
            upsertFood({
              id: foodId ?? undefined,
              nameAr: nameAr.trim(),
              servingLabel: servingLabel.trim(),
              ...parsed,
            });
            router.back();
          }}
        />

        {!isNew && foodId != null ? (
          <Button
            title="احذف"
            variant="ghost"
            onPress={() => {
              const result = deleteFood(foodId);
              if (result.ok) {
                router.back();
                return;
              }
              Alert.alert(
                'لا يمكن الحذف',
                'هذا الطعام مستخدم في وجبة أو في يوم مسجّل. أرشفته تُخفيه من القوائم وتبقي السجل صحيحاً.',
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'أرشفة',
                    onPress: () => {
                      archiveFood(foodId);
                      router.back();
                    },
                  },
                ],
              );
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
