import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import type { MissedReason } from '@/db/schema';
import { isPerfectWeek, MISSED_REASON_LABEL_AR } from '@/lib/adherence';
import { addDays, formatDayAr, startOfWeek, today, WEEKDAY_AR_SHORT, weekday } from '@/lib/date';
import { n } from '@/lib/num';
import { getReview, saveReview, scoresForWeek, toggleReviewReason } from '@/queries/progress';
import { radius, space, useColors } from '@/theme';

const REASONS = Object.keys(MISSED_REASON_LABEL_AR) as MissedReason[];

/**
 * Thursday evening: look at the week, tag why the misses happened, one tap each.
 *
 * Deliberately not a form. The value is in naming the pattern, not in writing
 * an essay about it — the note is optional and last.
 */
export default function WeeklyReviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));

  const { days, review } = useDbQuery(
    () => ({ days: scoresForWeek(weekStart), review: getReview(weekStart) }),
    [weekStart],
  );

  const [note, setNote] = useState(review.note ?? '');
  const [noteSeed, setNoteSeed] = useState(weekStart);
  if (noteSeed !== weekStart) {
    setNoteSeed(weekStart);
    setNote(review.note ?? '');
  }

  const scored = days.filter((day) => day.score.scored);
  const misses = scored.filter((day) => day.score.total < 100);
  const perfect = isPerfectWeek(days.map((day) => day.score));

  return (
    <Screen
      title="المراجعة الأسبوعية"
      subtitle={`أسبوع ${formatDayAr(weekStart)}`}
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale
            haptic="light"
            onPress={() => setWeekStart((current) => addDays(current, -7))}
            accessibilityLabel="الأسبوع السابق"
          >
            <Text variant="heading" color="textDim">
              ›
            </Text>
          </PressableScale>
          <Text variant="label" color="textDim">
            {`${n(scored.length - misses.length)} من ${n(scored.length)} أيام كاملة`}
          </Text>
          <PressableScale
            haptic="light"
            onPress={() => setWeekStart((current) => addDays(current, 7))}
            accessibilityLabel="الأسبوع التالي"
          >
            <Text variant="heading" color="textDim">
              ‹
            </Text>
          </PressableScale>
        </View>

        {perfect ? (
          <Card>
            <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
              <Text variant="display" color="good">
                ١٠٠
              </Text>
              <Text variant="heading" align="center">
                أسبوع كامل
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ------------------------------------------------------ the week */}
        <Card>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            {days.map((day) => {
              const { score } = day;
              const colour = !score.scored
                ? colors.track
                : score.total >= 100
                  ? colors.good
                  : score.total >= 80
                    ? colors.good + 'AA'
                    : score.total >= 50
                      ? colors.warn + 'AA'
                      : colors.bad + '88';
              return (
                <View key={day.date} style={{ alignItems: 'center', gap: space.sm }}>
                  <Text variant="caption" color="textFaint">
                    {WEEKDAY_AR_SHORT[weekday(day.date)]}
                  </Text>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.sm,
                      backgroundColor: colour,
                      borderWidth: score.scored ? 0 : 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {score.scored ? (
                      <Text variant="caption" color={score.total >= 50 ? 'bg' : 'text'}>
                        {n(score.total)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* --------------------------------------------------- what missed */}
        {misses.length > 0 ? (
          <View style={{ gap: space.md }}>
            <Text variant="heading">ما الذي فات؟</Text>
            <Card>
              <View style={{ gap: space.sm }}>
                {misses.map((day) => (
                  <View
                    key={day.date}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text variant="body">{formatDayAr(day.date)}</Text>
                    <Text variant="caption" color="textDim">
                      {[
                        day.score.kcal === 0 ? 'سعرات' : null,
                        day.score.protein === 0 ? 'بروتين' : null,
                        day.score.workout === 0 ? 'تمرين' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {/* ------------------------------------------------------- reasons */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">الأسباب</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {REASONS.map((reason) => {
              const active = review.missedReasons.includes(reason);
              return (
                <PressableScale
                  key={reason}
                  haptic="light"
                  onPress={() => toggleReviewReason(weekStart, reason)}
                >
                  <View
                    style={{
                      paddingVertical: space.sm + 2,
                      paddingHorizontal: space.lg,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text variant="label" color={active ? 'bg' : 'text'}>
                      {MISSED_REASON_LABEL_AR[reason]}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <Field label="ملاحظة (اختياري)" value={note} onChangeText={setNote} multiline />

        <Button
          title="احفظ المراجعة"
          onPress={() => {
            saveReview(weekStart, review.missedReasons, note.trim() || null);
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
