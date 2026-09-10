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
import type { DayType } from '@/db/schema';
import { kcalFromMacros, type Macros } from '@/lib/macros';
import { n } from '@/lib/num';
import { DAY_TYPE_LABEL_AR } from '@/lib/slots';
import { getAllTargets, setTarget } from '@/queries/meals';
import { space } from '@/theme';

const DAY_TYPES: DayType[] = ['training', 'rest', 'busy'];

export default function TargetsScreen() {
  const router = useRouter();
  const stored = useDbQuery(() => getAllTargets(), []);

  return (
    <Screen
      title="الأهداف"
      subtitle="السعرات والماكروز لكل نوع يوم"
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.lg }}>
        {DAY_TYPES.map((dayType) => (
          <TargetEditor key={dayType} dayType={dayType} initial={stored[dayType]} />
        ))}
      </View>
    </Screen>
  );
}

function TargetEditor({ dayType, initial }: { dayType: DayType; initial: Macros }) {
  const [kcal, setKcal] = useState(String(initial.kcal || ''));
  const [protein, setProtein] = useState(String(initial.proteinG || ''));
  const [carbs, setCarbs] = useState(String(initial.carbsG || ''));
  const [fat, setFat] = useState(String(initial.fatG || ''));

  const parsed: Macros = {
    kcal: Number(kcal),
    proteinG: Number(protein),
    carbsG: Number(carbs),
    fatG: Number(fat),
  };

  const valid = Object.values(parsed).every((value) => Number.isFinite(value) && value >= 0);
  const implied = kcalFromMacros(parsed);
  // 4/4/9 rarely lands exactly on a rounded calorie target; only flag a real gap.
  const mismatch = valid && parsed.kcal > 0 && Math.abs(implied - parsed.kcal) > parsed.kcal * 0.05;

  return (
    <Card>
      <View style={{ gap: space.md }}>
        <Text variant="heading">{DAY_TYPE_LABEL_AR[dayType]}</Text>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field label="سعرات" numeric value={kcal} onChangeText={setKcal} />
          <Field label="بروتين (جم)" numeric value={protein} onChangeText={setProtein} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field label="كارب (جم)" numeric value={carbs} onChangeText={setCarbs} />
          <Field label="دهون (جم)" numeric value={fat} onChangeText={setFat} />
        </View>

        {mismatch ? (
          <Text variant="caption" color="warn">
            {`الماكروز تعطي ${n(implied)} سعرة، والهدف ${n(parsed.kcal)}.`}
          </Text>
        ) : null}

        <Button
          title="احفظ"
          variant="secondary"
          disabled={!valid}
          onPress={() => setTarget(dayType, parsed)}
        />
      </View>
    </Card>
  );
}
