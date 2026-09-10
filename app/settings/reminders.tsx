import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { MEAL_SLOTS, SLOT_LABEL_AR } from '@/lib/slots';
import {
  applyReminders,
  loadReminders,
  type ReminderSettings,
} from '@/notifications/reminders';
import { space } from '@/theme';

export default function RemindersScreen() {
  const router = useRouter();
  const stored = useDbQuery(() => loadReminders(), []);

  const [value, setValue] = useState<ReminderSettings>(stored);
  const [denied, setDenied] = useState(false);

  const save = async (next: ReminderSettings) => {
    setValue(next);
    const ok = await applyReminders(next);
    setDenied(next.enabled && !ok);
  };

  return (
    <Screen
      title="التذكيرات"
      subtitle="محلية على الجهاز، بدون إنترنت"
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.lg }}>
        <Card>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="heading">تفعيل التذكيرات</Text>
            <Switch
              value={value.enabled}
              onValueChange={(enabled) => save({ ...value, enabled })}
            />
          </View>
          {denied ? (
            <Text variant="caption" color="warn" style={{ marginTop: space.sm }}>
              لم يُسمح للتطبيق بالإشعارات. فعّلها من إعدادات النظام.
            </Text>
          ) : null}
        </Card>

        {value.enabled ? (
          <>
            <Card>
              <View style={{ gap: space.lg }}>
                <Text variant="heading">أوقات الوجبات</Text>
                {MEAL_SLOTS.map((slot) => (
                  <View
                    key={slot}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text variant="body">{SLOT_LABEL_AR[slot]}</Text>
                    <Stepper
                      value={value.mealHours[slot] ?? null}
                      step={1}
                      min={0}
                      max={23}
                      decimals={0}
                      suffix=":00"
                      onChange={(hour) =>
                        save({ ...value, mealHours: { ...value.mealHours, [slot]: hour } })
                      }
                    />
                  </View>
                ))}
              </View>
            </Card>

            <Card>
              <View style={{ gap: space.lg }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="body">التمرين</Text>
                  <Stepper
                    value={value.workoutHour}
                    step={1}
                    min={0}
                    max={23}
                    decimals={0}
                    suffix=":00"
                    onChange={(workoutHour) => save({ ...value, workoutHour })}
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body">مراجعة الخميس</Text>
                    <Text variant="caption" color="textDim">
                      راجع أسبوعك وخطّط للقادم
                    </Text>
                  </View>
                  <Stepper
                    value={value.reviewHour}
                    step={1}
                    min={0}
                    max={23}
                    decimals={0}
                    suffix=":00"
                    onChange={(reviewHour) => save({ ...value, reviewHour })}
                  />
                </View>
              </View>
            </Card>

            <Button title="أعِد جدولة التذكيرات" variant="secondary" onPress={() => save(value)} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
