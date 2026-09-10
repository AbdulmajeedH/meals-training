import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Heatmap } from '@/components/Heatmap';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { WeightTrend } from '@/components/WeightTrend';
import { useDbQuery } from '@/db/useQuery';
import { currentStreak, weeklyWeightChange } from '@/lib/adherence';
import { addMonths, formatMonthAr, monthDates, startOfMonth, today } from '@/lib/date';
import { d, n, signed } from '@/lib/num';
import { listPersonalBests } from '@/queries/training';
import { latestWeight, listWeights, recordWeight, scoresForMonth } from '@/queries/progress';
import { space } from '@/theme';

export default function ProgressScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(() => startOfMonth(today()));

  const data = useDbQuery(
    () => ({
      days: scoresForMonth(month),
      weights: listWeights(),
      latest: latestWeight(),
      bests: listPersonalBests(),
    }),
    [month],
  );

  const { days, weights, latest, bests } = data;
  const chartWidth = width - space.lg * 2 - space.lg * 2;

  const streak = currentStreak(
    new Map(days.map((day) => [day.date, day.score])),
    monthDates(month),
  );

  const scored = days.filter((day) => day.score.scored);
  const average =
    scored.length > 0
      ? scored.reduce((total, day) => total + day.score.total, 0) / scored.length
      : null;

  const weeklyChange = weeklyWeightChange(weights);

  return (
    <Screen title="التقدم">
      <View style={{ gap: space.xl }}>
        {/* -------------------------------------------------------- streak */}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Card style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="metric" color={streak > 0 ? 'good' : 'textDim'}>
                {n(streak)}
              </Text>
              <Text variant="caption" color="textDim">
                يوم متتالي
              </Text>
            </View>
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="metric">{average == null ? '—' : n(average)}</Text>
              <Text variant="caption" color="textDim">
                متوسط الالتزام
              </Text>
            </View>
          </Card>
        </View>

        {/* ------------------------------------------------------- heatmap */}
        <View style={{ gap: space.md }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <PressableScale
              haptic="light"
              onPress={() => setMonth((current) => addMonths(current, -1))}
              accessibilityLabel="الشهر السابق"
            >
              <Text variant="heading" color="textDim">
                ›
              </Text>
            </PressableScale>
            <Text variant="heading">{formatMonthAr(month)}</Text>
            <PressableScale
              haptic="light"
              onPress={() => setMonth((current) => addMonths(current, 1))}
              accessibilityLabel="الشهر التالي"
            >
              <Text variant="heading" color="textDim">
                ‹
              </Text>
            </PressableScale>
          </View>

          <Card>
            <Heatmap days={days} width={chartWidth} />
          </Card>
        </View>

        {/* -------------------------------------------------------- weight */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">الوزن</Text>
          <Card>
            <View style={{ gap: space.md }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md }}
              >
                <Text variant="metric">{latest ? d(latest.kg) : '—'}</Text>
                <Text variant="caption" color="textDim">
                  كجم
                </Text>
                {weeklyChange != null ? (
                  <Text
                    variant="label"
                    color={weeklyChange > 0 ? 'good' : weeklyChange < 0 ? 'warn' : 'textDim'}
                  >
                    {`${signed(weeklyChange, 2)} هذا الأسبوع`}
                  </Text>
                ) : null}
              </View>

              {weights.length >= 2 ? (
                <WeightTrend points={weights} width={chartWidth} />
              ) : (
                <Text variant="caption" color="textDim">
                  سجّل وزنك ٣ صباحات أسبوعياً لتظهر لك خطة التقدم.
                </Text>
              )}

              <WeightEntry />
            </View>
          </Card>
        </View>

        {/* ----------------------------------------------------------- PRs */}
        <View style={{ gap: space.md }}>
          <Text variant="heading">أرقامك الشخصية</Text>
          {bests.length === 0 ? (
            <Card>
              <Text variant="caption" color="textDim">
                لا توجد أرقام بعد. أنهِ تمريناً لتُسجَّل.
              </Text>
            </Card>
          ) : (
            <Card>
              <View style={{ gap: space.md }}>
                {bests.map((best) => (
                  <View
                    key={best.exerciseId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {best.name}
                    </Text>
                    <Text variant="label" color="textDim">
                      {`${d(best.weightKg)} × ${n(best.reps)}`}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>

        <Button
          title="المراجعة الأسبوعية"
          variant="secondary"
          onPress={() => router.push('/review' as never)}
        />
      </View>
    </Screen>
  );
}

function WeightEntry() {
  const [value, setValue] = useState('');
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 20 && parsed < 300;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
      <Field
        label="وزن اليوم (كجم)"
        numeric
        value={value}
        onChangeText={setValue}
        placeholder="50.7"
      />
      <Button
        title="سجّل"
        variant="secondary"
        disabled={!valid}
        onPress={() => {
          recordWeight(today(), parsed);
          setValue('');
        }}
      />
    </View>
  );
}
