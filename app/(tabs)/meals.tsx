import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MealCard } from '@/components/MealCard';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { addDays, formatDayAr, startOfWeek, today, WEEKDAY_AR_SHORT, weekday } from '@/lib/date';
import { d, n } from '@/lib/num';
import { archiveMeal, confirmMeal, deleteMeal, getDayLog, listFoods, listMeals } from '@/queries/meals';
import {
  copyWeek,
  getWeek,
  listTemplates,
  mealPrepList,
  setDayTemplate,
  shoppingList,
} from '@/queries/plan';
import { programDayForDate } from '@/queries/training';
import { radius, space, useColors } from '@/theme';

type Tab = 'log' | 'week' | 'shopping' | 'library';

const TABS: { value: Tab; label: string }[] = [
  { value: 'log', label: 'اليوم' },
  { value: 'week', label: 'الأسبوع' },
  { value: 'shopping', label: 'التسوّق' },
  { value: 'library', label: 'المكتبة' },
];

export default function MealsScreen() {
  const [tab, setTab] = useState<Tab>('log');

  return (
    <Screen title="الوجبات">
      <View style={{ gap: space.xl }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
        {tab === 'log' ? <TodayLog /> : null}
        {tab === 'week' ? <WeekPlan /> : null}
        {tab === 'shopping' ? <Shopping /> : null}
        {tab === 'library' ? <Library /> : null}
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------- today's log */

function TodayLog() {
  const router = useRouter();
  const date = today();
  const day = useDbQuery(() => getDayLog(date, programDayForDate(date) != null), [date]);

  if (day.slots.length === 0) {
    return (
      <Card>
        <Text variant="caption" color="textDim">
          لا توجد وجبات مخطّطة لليوم. اربط اليوم بقالب من تبويب الأسبوع.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <Text variant="caption" color="textDim">
        {`${formatDayAr(date)} · ${n(day.consumed.kcal)} من ${n(day.target.kcal)} سعرة`}
      </Text>
      {day.slots.map((slot) => (
        <MealCard
          key={slot.slot}
          slot={slot}
          onConfirm={() => confirmMeal(date, slot.slot, slot.plannedMeal?.id ?? null)}
          onOpen={() => router.push(`/log/${date}/${slot.slot}` as never)}
        />
      ))}
    </View>
  );
}

/* --------------------------------------------------------------- week plan */

function WeekPlan() {
  const colors = useColors();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));

  const { week, templates } = useDbQuery(
    () => ({ week: getWeek(weekStart), templates: listTemplates() }),
    [weekStart],
  );

  if (templates.length === 0) {
    return (
      <Card>
        <View style={{ gap: space.md, alignItems: 'center' }}>
          <Text variant="caption" color="textDim" align="center">
            لا توجد قوالب أيام بعد. القالب هو يوم كامل من الوجبات، وتُدير أسبوعك بتناوب قالبين أو ثلاثة.
          </Text>
          <Button
            title="أنشئ قالباً"
            variant="secondary"
            onPress={() => router.push('/settings/templates' as never)}
          />
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale
          haptic="light"
          onPress={() => setWeekStart((current) => shiftWeek(current, -1))}
          accessibilityLabel="الأسبوع السابق"
        >
          <Text variant="heading" color="textDim">
            ›
          </Text>
        </PressableScale>
        <Text variant="label">{`أسبوع ${formatDayAr(weekStart)}`}</Text>
        <PressableScale
          haptic="light"
          onPress={() => setWeekStart((current) => shiftWeek(current, 1))}
          accessibilityLabel="الأسبوع التالي"
        >
          <Text variant="heading" color="textDim">
            ‹
          </Text>
        </PressableScale>
      </View>

      {week.map((day) => (
        <PressableScale
          key={day.date}
          haptic="light"
          onPress={() => {
            // Cycle through the templates, then back to no plan.
            const index = templates.findIndex((t) => t.id === day.template?.id);
            const next = index + 1 >= templates.length ? null : templates[index + 1].id;
            setDayTemplate(day.date, next);
          }}
        >
          <Card>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ gap: 2, flex: 1 }}>
                <Text variant="body">{WEEKDAY_AR_SHORT[weekday(day.date)]}</Text>
                <Text variant="caption" color="textFaint">
                  {day.date}
                </Text>
              </View>
              {day.isBusy ? (
                <View
                  style={{
                    paddingHorizontal: space.sm,
                    paddingVertical: 2,
                    borderRadius: radius.pill,
                    backgroundColor: colors.track,
                    marginEnd: space.sm,
                  }}
                >
                  <Text variant="caption" color="warn">
                    مشغول
                  </Text>
                </View>
              ) : null}
              <Text variant="label" color={day.template ? 'accent' : 'textFaint'}>
                {day.template?.nameAr ?? 'بدون'}
              </Text>
            </View>
          </Card>
        </PressableScale>
      ))}

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button
          title="انسخ للأسبوع القادم"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => copyWeek(weekStart, shiftWeek(weekStart, 1))}
        />
        <Button
          title="القوالب"
          variant="ghost"
          onPress={() => router.push('/settings/templates' as never)}
        />
      </View>
    </View>
  );
}

function shiftWeek(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7);
}

/* ----------------------------------------------------------- shopping list */

function Shopping() {
  const weekStart = startOfWeek(today());
  const { lines, prep } = useDbQuery(
    () => ({ lines: shoppingList(weekStart), prep: mealPrepList(weekStart) }),
    [weekStart],
  );

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <Text variant="heading">قائمة الشراء</Text>
        {lines.length === 0 ? (
          <Card>
            <Text variant="caption" color="textDim">
              لا توجد خطة لهذا الأسبوع بعد.
            </Text>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: space.md }}>
              {lines.map((line) => (
                <View
                  key={line.food.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {line.food.nameAr}
                  </Text>
                  <Text variant="label" color="textDim">
                    {`${d(line.servings)} × ${line.food.servingLabel}`}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>

      {prep.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Text variant="heading">للطبخ دفعة واحدة</Text>
          <Card>
            <View style={{ gap: space.md }}>
              {prep.map((entry) => (
                <View
                  key={entry.mealId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text variant="label" color="accent">
                    {`${n(entry.portions)} حصص`}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- library */

function Library() {
  const router = useRouter();
  const { meals, foods } = useDbQuery(() => ({ meals: listMeals(), foods: listFoods() }), []);

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="heading">الوجبات</Text>
          <PressableScale haptic="light" onPress={() => router.push('/meal/new' as never)}>
            <Text variant="label" color="accent">
              + وجبة
            </Text>
          </PressableScale>
        </View>

        {meals.length === 0 ? (
          <Card>
            <Text variant="caption" color="textDim">
              لا توجد وجبات بعد.
            </Text>
          </Card>
        ) : (
          meals.map((meal) => (
            <PressableScale
              key={meal.id}
              haptic="light"
              onPress={() => router.push(`/meal/${meal.id}` as never)}
              onLongPress={() => {
                Alert.alert('حذف الوجبة', meal.nameAr, [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: () => {
                      const result = deleteMeal(meal.id);
                      if (!result.ok) {
                        Alert.alert(
                          'لا يمكن الحذف',
                          'هذه الوجبة مستخدمة في قالب. أرشفتها تُخفيها من المكتبة وتبقي الخطة.',
                          [
                            { text: 'إلغاء', style: 'cancel' },
                            { text: 'أرشفة', onPress: () => archiveMeal(meal.id) },
                          ],
                        );
                      }
                    },
                  },
                ]);
              }}
            >
              <Card>
                <View style={{ gap: 2 }}>
                  <Text variant="heading" numberOfLines={1}>
                    {meal.nameAr}
                  </Text>
                  <Text variant="caption" color="textDim">
                    {`${n(meal.macros.kcal)} سعرة · ${n(meal.macros.proteinG)} بروتين · ${n(
                      meal.items.length,
                    )} مكوّنات`}
                  </Text>
                </View>
              </Card>
            </PressableScale>
          ))
        )}
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="heading">الأطعمة</Text>
          <PressableScale haptic="light" onPress={() => router.push('/food/new' as never)}>
            <Text variant="label" color="accent">
              + طعام
            </Text>
          </PressableScale>
        </View>

        {foods.length === 0 ? (
          <Card>
            <Text variant="caption" color="textDim">
              لا توجد أطعمة بعد. ابدأ بإضافة ما تأكله فعلاً.
            </Text>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: space.md }}>
              {foods.map((food) => (
                <PressableScale
                  key={food.id}
                  haptic="light"
                  onPress={() => router.push(`/food/${food.id}` as never)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body" numberOfLines={1}>
                        {food.nameAr}
                      </Text>
                      <Text variant="caption" color="textFaint">
                        {food.servingLabel}
                      </Text>
                    </View>
                    <Text variant="label" color="textDim">
                      {`${n(food.kcal)} سعرة · ${n(food.proteinG)} بروتين`}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </Card>
        )}
      </View>
    </View>
  );
}
