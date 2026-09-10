import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';

import { Card } from '@/components/Card';
import { MealCard } from '@/components/MealCard';
import { PressableScale } from '@/components/PressableScale';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { formatDayAr, today } from '@/lib/date';
import { ratio, remaining } from '@/lib/macros';
import { n } from '@/lib/num';
import { DAY_TYPE_LABEL_AR } from '@/lib/slots';
import { confirmMeal, getDayLog, hasTargets } from '@/queries/meals';
import { getTodaySession, hasProgram, programDayForDate } from '@/queries/training';
import { setBusy } from '@/queries/plan';
import { hasSchedule } from '@/db/seed/program';
import { space, useColors } from '@/theme';

/**
 * The home screen answers exactly two questions: what is left to eat today, and
 * what today's workout is. Anything else belongs on another tab.
 */
export default function TodayScreen() {
  const router = useRouter();
  const colors = useColors();
  const [date, setDate] = useState(today);

  useFocusEffect(
    useCallback(() => {
      setDate(today());
    }, []),
  );

  const data = useDbQuery(() => {
    const isTrainingDay = programDayForDate(date) != null;
    return {
      day: getDayLog(date, isTrainingDay),
      targetsSet: hasTargets(),
      programSet: hasProgram(),
      scheduleSet: hasSchedule(),
      session: hasProgram() ? getTodaySession(date) : null,
    };
  }, [date]);

  const { day, targetsSet, programSet, scheduleSet, session } = data;
  const left = remaining(day.target, day.consumed);

  return (
    <Screen title="اليوم" subtitle={`${formatDayAr(date)} · ${DAY_TYPE_LABEL_AR[day.dayType]}`}>
      <View style={{ gap: space.xl }}>
        {/* --------------------------------------------- what's left to eat */}
        {targetsSet ? (
          <Card>
            <View style={{ gap: space.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <Ring
                  progress={ratio(day.consumed.kcal, day.target.kcal)}
                  color={colors.kcal}
                  value={left.kcal}
                  unit="سعرة"
                  label="متبقّي"
                />
                <Ring
                  progress={ratio(day.consumed.proteinG, day.target.proteinG)}
                  color={colors.protein}
                  value={left.proteinG}
                  unit="جم"
                  label="بروتين"
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Macro label="كارب" value={day.consumed.carbsG} target={day.target.carbsG} />
                <Macro label="دهون" value={day.consumed.fatG} target={day.target.fatG} />
                <Macro label="سعرات" value={day.consumed.kcal} target={day.target.kcal} />
              </View>
            </View>
          </Card>
        ) : (
          <EmptyPrompt
            title="لم تُحدَّد الأهداف بعد"
            body="حدّد السعرات والماكروز لكل نوع يوم لتبدأ المتابعة."
            href="/settings/targets"
            action="افتح الأهداف"
          />
        )}

        {/* ------------------------------------------------------ busy mode */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">يوم مشغول</Text>
              <Text variant="caption" color="textDim">
                يبدّل الأهداف والقالب، واليوم يبقى محسوباً.
              </Text>
            </View>
            <Switch
              value={day.isBusy}
              onValueChange={(value) => setBusy(date, value)}
              trackColor={{ true: colors.accent, false: colors.track }}
            />
          </View>
        </Card>

        {/* ------------------------------------------------------ the meals */}
        {day.slots.length > 0 ? (
          <View style={{ gap: space.md }}>
            <Text variant="heading">وجبات اليوم</Text>
            {day.slots.map((slot) => (
              <MealCard
                key={slot.slot}
                slot={slot}
                onConfirm={() => confirmMeal(date, slot.slot, slot.plannedMeal?.id ?? null)}
                onOpen={() => router.push(`/log/${date}/${slot.slot}` as never)}
              />
            ))}
          </View>
        ) : (
          <EmptyPrompt
            title="لا توجد خطة لليوم"
            body="اربط اليوم بقالب من خطة الأسبوع، أو سجّل وجبة مباشرة."
            href="/(tabs)/meals"
            action="افتح الوجبات"
          />
        )}

        {/* ---------------------------------------------------- the workout */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">تمرين اليوم</Text>
          {!programSet ? (
            <EmptyPrompt
              title="لا يوجد برنامج"
              body="أضف أيام برنامجك لتبدأ تسجيل التمارين."
              href="/settings/program"
              action="افتح محرّر البرنامج"
            />
          ) : !scheduleSet ? (
            <EmptyPrompt
              title="حدّد أيام التمرين"
              body="برنامجك جاهز، لكن لم تُحدَّد أيام الأسبوع بعد."
              href="/settings/program"
              action="افتح جدول الأسبوع"
            />
          ) : session?.kind === 'rest' ? (
            <Card>
              <Text variant="body" color="textDim">
                يوم راحة.
              </Text>
            </Card>
          ) : session?.kind === 'workout' ? (
            <Link href="/(tabs)/training" asChild>
              <PressableScale haptic="light">
                <Card>
                  <View style={{ gap: space.xs }}>
                    <Text variant="heading">{session.programDay.name}</Text>
                    <Text variant="caption" color="textDim">
                      {`${n(session.items.length)} تمارين · ${n(
                        session.items.reduce(
                          (total, item) => total + item.sets.filter((s) => s.done).length,
                          0,
                        ),
                      )} من ${n(
                        session.items.reduce((total, item) => total + item.sets.length, 0),
                      )} مجموعة`}
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            </Link>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="heading">{n(value)}</Text>
      <Text variant="caption" color="textFaint">
        {`من ${n(target)}`}
      </Text>
      <Text variant="caption" color="textDim">
        {label}
      </Text>
    </View>
  );
}

function EmptyPrompt({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <Card>
      <View style={{ gap: space.sm, alignItems: 'center', paddingVertical: space.md }}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        <Text variant="caption" color="textDim" align="center">
          {body}
        </Text>
        <Link href={href as never} asChild>
          <PressableScale haptic="light">
            <View style={{ paddingVertical: space.sm, paddingHorizontal: space.lg }}>
              <Text variant="label" color="accent">
                {action}
              </Text>
            </View>
          </PressableScale>
        </Link>
      </View>
    </Card>
  );
}
