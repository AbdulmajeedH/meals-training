import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import type { DayType } from '@/db/schema';
import { startOfWeek, today } from '@/lib/date';
import { n } from '@/lib/num';
import { DAY_TYPE_LABEL_AR, MEAL_SLOTS, SLOT_LABEL_AR } from '@/lib/slots';
import { listMeals } from '@/queries/meals';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  rotateTemplates,
  setTemplateSlot,
} from '@/queries/plan';
import { radius, space, useColors } from '@/theme';

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: 'training', label: DAY_TYPE_LABEL_AR.training },
  { value: 'rest', label: DAY_TYPE_LABEL_AR.rest },
  { value: 'busy', label: DAY_TYPE_LABEL_AR.busy },
];

/**
 * Day templates: a whole day of meals, reused. Two or three of these rotating
 * beats seven bespoke days, which is the point of the scheduling model.
 */
export default function TemplatesScreen() {
  const router = useRouter();
  const colors = useColors();

  const { templates, meals } = useDbQuery(
    () => ({ templates: listTemplates(), meals: listMeals() }),
    [],
  );

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<DayType>('training');
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Screen
      title="قوالب الأيام"
      subtitle="يوم كامل من الوجبات، يُعاد استخدامه"
      action={
        <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
          <Text variant="label" color="accent">
            تم
          </Text>
        </PressableScale>
      }
    >
      <View style={{ gap: space.xl }}>
        {templates.map((template) => (
          <Card key={template.id}>
            <View style={{ gap: space.md }}>
              <PressableScale
                haptic="light"
                onPress={() => setOpenId(openId === template.id ? null : template.id)}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="heading">{template.nameAr}</Text>
                  <Text variant="caption" color="textDim">
                    {`${DAY_TYPE_LABEL_AR[template.dayType]} · ${n(template.slots.length)} وجبات`}
                  </Text>
                </View>
              </PressableScale>

              {openId === template.id ? (
                <View style={{ gap: space.sm }}>
                  {MEAL_SLOTS.map((slot) => {
                    const assigned = template.slots.find((s) => s.slot === slot);
                    return (
                      <PressableScale
                        key={slot}
                        haptic="light"
                        onPress={() => {
                          // Cycle through the meal library, then back to empty.
                          const index = meals.findIndex((m) => m.id === assigned?.mealId);
                          const next = index + 1 >= meals.length ? null : meals[index + 1].id;
                          setTemplateSlot(template.id, slot, next);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: space.md,
                            paddingHorizontal: space.md,
                            borderRadius: radius.sm,
                            backgroundColor: colors.surfaceRaised,
                          }}
                        >
                          <Text variant="body">{SLOT_LABEL_AR[slot]}</Text>
                          <Text
                            variant="label"
                            color={assigned ? 'accent' : 'textFaint'}
                            numberOfLines={1}
                            style={{ flexShrink: 1 }}
                          >
                            {assigned?.mealName ?? 'فارغ'}
                          </Text>
                        </View>
                      </PressableScale>
                    );
                  })}

                  <Button
                    title="احذف القالب"
                    variant="ghost"
                    onPress={() => {
                      Alert.alert('حذف القالب', template.nameAr, [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'حذف',
                          style: 'destructive',
                          onPress: () => {
                            deleteTemplate(template.id);
                            setOpenId(null);
                          },
                        },
                      ]);
                    }}
                  />
                </View>
              ) : null}
            </View>
          </Card>
        ))}

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">قالب جديد</Text>
            <Field
              label="الاسم"
              value={newName}
              onChangeText={setNewName}
              placeholder="مثال: يوم تمرين عادي"
            />
            <Segmented options={DAY_TYPE_OPTIONS} value={newType} onChange={setNewType} />
            <Button
              title="أضف"
              variant="secondary"
              disabled={newName.trim().length === 0}
              onPress={() => {
                const id = createTemplate(newName.trim(), newType);
                setNewName('');
                setOpenId(id);
              }}
            />
          </View>
        </Card>

        {templates.length > 0 ? (
          <Button
            title="وزّع القوالب على هذا الأسبوع"
            onPress={() =>
              rotateTemplates(
                startOfWeek(today()),
                templates.map((t) => t.id),
              )
            }
          />
        ) : null}

        {meals.length === 0 ? (
          <Text variant="caption" color="textDim" align="center">
            أضف وجبات في المكتبة أولاً حتى تربطها بخانات القالب.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
