import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import type { Exercise } from '@/db/schema';
import { WEEKDAY_AR } from '@/lib/date';
import { n } from '@/lib/num';
import {
  archiveExercise,
  archiveProgramDay,
  createProgramDay,
  deleteExercise,
  deleteProgramDay,
  getSchedule,
  listExercises,
  listProgramDays,
  setScheduleDay,
  upsertExercise,
  type ExerciseDraft,
} from '@/queries/training';
import { radius, space, useColors } from '@/theme';

export default function ProgramEditorScreen() {
  const router = useRouter();
  const colors = useColors();

  const days = useDbQuery(() => listProgramDays(), []);
  const schedule = useDbQuery(() => getSchedule(), []);

  const [newDayName, setNewDayName] = useState('');
  const [openDayId, setOpenDayId] = useState<number | null>(null);
  const [editingExercise, setEditingExercise] = useState<
    (Partial<Exercise> & { programDayId: number }) | null
  >(null);

  return (
    <>
      <Screen
        title="محرّر البرنامج"
        subtitle="أيام البرنامج وتمارينها، وجدول الأسبوع"
        action={
          <PressableScale onPress={() => router.back()} haptic="light" accessibilityLabel="رجوع">
            <Text variant="label" color="accent">
              تم
            </Text>
          </PressableScale>
        }
      >
        <View style={{ gap: space.xl }}>
          {/* ---------------------------------------------------- days */}
          <View style={{ gap: space.md }}>
            <Text variant="heading">أيام البرنامج</Text>

            {days.map((day) => (
              <Card key={day.id}>
                <View style={{ gap: space.md }}>
                  <PressableScale
                    haptic="light"
                    onPress={() => setOpenDayId(openDayId === day.id ? null : day.id)}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text variant="heading">{day.name}</Text>
                      <Text variant="caption" color="textDim">
                        {n(day.exerciseCount)} تمرين
                      </Text>
                    </View>
                  </PressableScale>

                  {openDayId === day.id ? (
                    <ExerciseList
                      programDayId={day.id}
                      onEdit={setEditingExercise}
                      onDeleteDay={() => {
                        Alert.alert('حذف اليوم', `سيُحذف ${day.name} وكل تمارينه.`, [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: () => {
                              const result = deleteProgramDay(day.id);
                              if (result.ok) {
                                setOpenDayId(null);
                                return;
                              }
                              // The day has logged sessions; deleting it would
                              // erase what was actually lifted.
                              Alert.alert(
                                'لا يمكن الحذف',
                                'هذا اليوم فيه جلسات مسجّلة. أرشفته تُخرجه من الجدول وتبقي السجل.',
                                [
                                  { text: 'إلغاء', style: 'cancel' },
                                  {
                                    text: 'أرشفة',
                                    onPress: () => {
                                      archiveProgramDay(day.id);
                                      setOpenDayId(null);
                                    },
                                  },
                                ],
                              );
                            },
                          },
                        ]);
                      }}
                    />
                  ) : null}
                </View>
              </Card>
            ))}

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
                <Field
                  label="يوم جديد"
                  placeholder="مثال: Push"
                  value={newDayName}
                  onChangeText={setNewDayName}
                />
                <Button
                  title="أضف"
                  variant="secondary"
                  disabled={newDayName.trim().length === 0}
                  onPress={() => {
                    const day = createProgramDay(newDayName.trim());
                    setNewDayName('');
                    setOpenDayId(day.id);
                  }}
                />
              </View>
            </Card>
          </View>

          {/* ------------------------------------------------ schedule */}
          <View style={{ gap: space.md }}>
            <Text variant="heading">جدول الأسبوع</Text>
            <Text variant="caption" color="textDim">
              اضغط على اليوم لتبديل البرنامج المرتبط به. بدون برنامج = يوم راحة.
            </Text>

            <Card>
              <View style={{ gap: space.sm }}>
                {schedule.map((row) => {
                  const day = days.find((item) => item.id === row.programDayId);
                  return (
                    <PressableScale
                      key={row.weekday}
                      haptic="light"
                      onPress={() => {
                        // Cycle: rest -> first day -> ... -> last day -> rest.
                        const index = days.findIndex((item) => item.id === row.programDayId);
                        const next = index + 1 >= days.length ? null : days[index + 1].id;
                        setScheduleDay(row.weekday, next);
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
                        <Text variant="body">{WEEKDAY_AR[row.weekday]}</Text>
                        <Text variant="label" color={day ? 'accent' : 'textFaint'}>
                          {day?.name ?? 'راحة'}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </Card>
          </View>
        </View>
      </Screen>

      <ExerciseEditor
        draft={editingExercise}
        onClose={() => setEditingExercise(null)}
        onSave={(exercise) => {
          upsertExercise(exercise);
          setEditingExercise(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------- exercises */

function ExerciseList({
  programDayId,
  onEdit,
  onDeleteDay,
}: {
  programDayId: number;
  onEdit: (draft: Partial<Exercise> & { programDayId: number }) => void;
  onDeleteDay: () => void;
}) {
  const colors = useColors();
  const exercises = useDbQuery(() => listExercises(programDayId), [programDayId]);

  return (
    <View style={{ gap: space.sm }}>
      {exercises.map((exercise) => (
        <PressableScale key={exercise.id} haptic="light" onPress={() => onEdit(exercise)}>
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
            <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {exercise.name}
            </Text>
            <Text variant="caption" color="textDim">
              {`${n(exercise.sets)} × ${n(exercise.repMin)}–${n(exercise.repMax)} · ${n(exercise.restSec)}ث`}
            </Text>
          </View>
        </PressableScale>
      ))}

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <Button
          title="أضف تمرين"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => onEdit({ programDayId })}
        />
        <Button title="احذف اليوم" variant="ghost" onPress={onDeleteDay} />
      </View>
    </View>
  );
}

function ExerciseEditor({
  draft,
  onClose,
  onSave,
}: {
  draft: (Partial<Exercise> & { programDayId: number }) | null;
  onClose: () => void;
  onSave: (exercise: ExerciseDraft) => void;
}) {
  const [seed, setSeed] = useState<number | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [repMin, setRepMin] = useState('8');
  const [repMax, setRepMax] = useState('12');
  const [restSec, setRestSec] = useState('120');
  const [notes, setNotes] = useState('');

  // Reseed whenever a different exercise is opened.
  const key = draft ? (draft.id ?? -draft.programDayId) : undefined;
  if (key !== seed) {
    setSeed(key);
    setName(draft?.name ?? '');
    setSets(String(draft?.sets ?? 3));
    setRepMin(String(draft?.repMin ?? 8));
    setRepMax(String(draft?.repMax ?? 12));
    setRestSec(String(draft?.restSec ?? 120));
    setNotes(draft?.notes ?? '');
  }

  const parsed = {
    sets: Number(sets),
    repMin: Number(repMin),
    repMax: Number(repMax),
    restSec: Number(restSec),
  };

  const valid =
    name.trim().length > 0 &&
    Number.isFinite(parsed.sets) &&
    parsed.sets > 0 &&
    Number.isFinite(parsed.repMin) &&
    Number.isFinite(parsed.repMax) &&
    parsed.repMin > 0 &&
    parsed.repMax >= parsed.repMin &&
    Number.isFinite(parsed.restSec) &&
    parsed.restSec >= 0;

  return (
    <Modal visible={draft != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end', padding: space.lg }}>
        <Card raised>
          <View style={{ gap: space.lg }}>
            <Text variant="heading" align="center">
              {draft?.id ? 'تعديل تمرين' : 'تمرين جديد'}
            </Text>

            <Field label="الاسم" value={name} onChangeText={setName} placeholder="مثال: بنش برس" />

            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Field label="مجموعات" numeric value={sets} onChangeText={setSets} />
              <Field label="أقل تكرار" numeric value={repMin} onChangeText={setRepMin} />
              <Field label="أعلى تكرار" numeric value={repMax} onChangeText={setRepMax} />
            </View>

            <Field label="الراحة (ثانية)" numeric value={restSec} onChangeText={setRestSec} />
            <Field label="ملاحظات" value={notes} onChangeText={setNotes} placeholder="اختياري" />

            <View style={{ flexDirection: 'row', gap: space.md }}>
              {draft?.id ? (
                <Button
                  title="حذف"
                  variant="ghost"
                  onPress={() => {
                    const id = draft.id as number;
                    const result = deleteExercise(id);
                    if (result.ok) {
                      onClose();
                      return;
                    }
                    Alert.alert(
                      'لا يمكن الحذف',
                      'هذا التمرين له مجموعات مسجّلة. أرشفته تُخرجه من البرنامج وتبقي الأرقام.',
                      [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'أرشفة',
                          onPress: () => {
                            archiveExercise(id);
                            onClose();
                          },
                        },
                      ],
                    );
                  }}
                />
              ) : null}
              <Button title="إلغاء" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
              <Button
                title="حفظ"
                style={{ flex: 1 }}
                disabled={!valid}
                onPress={() =>
                  draft &&
                  onSave({
                    id: draft.id,
                    programDayId: draft.programDayId,
                    name: name.trim(),
                    sets: parsed.sets,
                    repMin: parsed.repMin,
                    repMax: parsed.repMax,
                    restSec: parsed.restSec,
                    notes: notes.trim() || null,
                  })
                }
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
