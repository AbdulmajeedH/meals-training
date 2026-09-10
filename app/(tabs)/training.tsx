import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { RestTimer } from '@/components/RestTimer';
import { Screen } from '@/components/Screen';
import { SetChip } from '@/components/SetChip';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { useDbQuery } from '@/db/useQuery';
import { formatDayAr, today } from '@/lib/date';
import { d, n } from '@/lib/num';
import type { SetLog } from '@/db/schema';
import { hasSchedule } from '@/db/seed/program';
import {
  applyWeightToRemaining,
  finishSession,
  getTodaySession,
  hasProgram,
  startSession,
  toggleSet,
  updateSet,
  type ExerciseWithSets,
} from '@/queries/training';
import { useRestTimer } from '@/stores/restTimer';
import { radius, space, useColors } from '@/theme';

export default function TrainingScreen() {
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<SetLog | null>(null);
  const [celebrating, setCelebrating] = useState<string[]>([]);

  // Re-read the date on focus so the screen does not stay on yesterday after
  // the app has been left open overnight.
  useFocusEffect(
    useCallback(() => {
      setDate(today());
    }, []),
  );

  const { programExists, scheduled } = useDbQuery(
    () => ({ programExists: hasProgram(), scheduled: hasSchedule() }),
    [],
  );
  const state = useDbQuery(() => (programExists ? getTodaySession(date) : null), [date, programExists]);

  if (!programExists) return <NoProgram />;
  // No weekday has a program day yet: that is an unfinished setup, not a rest
  // day, and it needs somewhere to go rather than a dead end.
  if (!scheduled) return <NoSchedule />;
  if (!state) return null;
  if (state.kind === 'rest') return <RestDay date={date} />;

  const { session, programDay, items } = state;
  const doneCount = items.reduce((sum, item) => sum + item.sets.filter((s) => s.done).length, 0);
  const totalCount = items.reduce((sum, item) => sum + item.sets.length, 0);
  const finished = session.status === 'completed';

  return (
    <>
      <Screen
        title={programDay.name}
        subtitle={`${formatDayAr(date)} · ${n(doneCount)} من ${n(totalCount)} مجموعة`}
      >
        <View style={{ gap: space.lg }}>
          {items.map((item) => (
            <ExerciseBlock
              key={item.exercise.id}
              item={item}
              disabled={finished}
              onToggleSet={(set) => {
                startSession(session.id);
                const nowDone = !set.done;
                toggleSet(set.id, { done: nowDone });
                if (nowDone) {
                  useRestTimer
                    .getState()
                    .start(item.exercise.restSec, item.exercise.name);
                }
              }}
              onEditSet={setEditing}
              onWeightChange={(weightKg) =>
                applyWeightToRemaining(session.id, item.exercise.id, weightKg)
              }
            />
          ))}

          {finished ? (
            <Card>
              <Text variant="heading" color="good" align="center">
                انتهى التمرين
              </Text>
            </Card>
          ) : (
            <Button
              title="أنهِ التمرين"
              haptic="success"
              disabled={doneCount === 0}
              onPress={() => {
                const beaten = finishSession(session.id, date);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                if (beaten.length > 0) {
                  const names = items
                    .filter((item) => beaten.includes(item.exercise.id))
                    .map((item) => item.exercise.name);
                  setCelebrating(names);
                }
              }}
            />
          )}
        </View>
      </Screen>

      <RestTimer />

      <SetEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateSet(editing.id, patch);
          setEditing(null);
        }}
      />

      <PrCelebration names={celebrating} onDismiss={() => setCelebrating([])} />
    </>
  );
}

/* ---------------------------------------------------------------- blocks */

type ExerciseBlockProps = {
  item: ExerciseWithSets;
  disabled: boolean;
  onToggleSet: (set: SetLog) => void;
  onEditSet: (set: SetLog) => void;
  onWeightChange: (weightKg: number) => void;
};

function ExerciseBlock({ item, disabled, onToggleSet, onEditSet, onWeightChange }: ExerciseBlockProps) {
  const colors = useColors();
  const { exercise, sets, last, suggestion } = item;
  const timed = exercise.repUnit === 'seconds';

  // The working weight is whatever the not-yet-done sets are carrying.
  const pending = sets.find((s) => !s.done) ?? sets[sets.length - 1];
  const workingWeight = pending?.weightKg ?? null;

  return (
    <Card>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{exercise.name}</Text>
            <Text variant="caption" color="textDim">
              {timed
                ? `${n(exercise.sets)} × ${n(exercise.repMin)} ث`
                : exercise.repMin === exercise.repMax
                  ? `${n(exercise.sets)} × ${n(exercise.repMin)}`
                  : `${n(exercise.sets)} × ${n(exercise.repMin)}–${n(exercise.repMax)}`}
              {timed
                ? ''
                : last.weightKg != null
                  ? ` · آخر مرة ${d(last.weightKg)} × ${n(last.reps ?? 0)}`
                  : ' · أول مرة'}
            </Text>
          </View>
        </View>

        {suggestion != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: colors.track,
              borderRadius: radius.sm,
              paddingVertical: space.sm,
              paddingHorizontal: space.md,
            }}
          >
            <Text variant="label" color="good">
              أكملت المدى كاملاً
            </Text>
            <Text variant="label" color="textDim">
              جرّب {d(suggestion)} كجم
            </Text>
          </View>
        ) : null}

        {exercise.notes ? (
          <Text variant="caption" color="textFaint">
            {exercise.notes}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {sets.map((set) => (
            <SetChip
              key={set.id}
              set={set}
              repUnit={exercise.repUnit}
              onToggle={() => !disabled && onToggleSet(set)}
              onEdit={() => !disabled && onEditSet(set)}
            />
          ))}
        </View>

        {!disabled && !timed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stepper
              label="وزن المجموعات المتبقية"
              value={workingWeight}
              suffix="كجم"
              step={2.5}
              onChange={onWeightChange}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/* ---------------------------------------------------------------- states */

function RestDay({ date }: { date: string }) {
  return (
    <Screen title="التمارين" subtitle={formatDayAr(date)}>
      <Card>
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
          <Text variant="title">يوم راحة</Text>
          <Text variant="body" color="textDim" align="center">
            لا يوجد تمرين مجدول اليوم.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function NoSchedule() {
  return (
    <Screen title="التمارين">
      <Card>
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Text variant="title" align="center">
            حدّد أيام التمرين
          </Text>
          <Text variant="body" color="textDim" align="center">
            برنامجك جاهز بأيامه الخمسة، لكن لم تُحدَّد أيام الأسبوع بعد.
          </Text>
          <Link href="/settings/program" asChild>
            <PressableScale haptic="light">
              <View style={{ paddingVertical: space.sm, paddingHorizontal: space.lg }}>
                <Text variant="heading" color="accent">
                  افتح جدول الأسبوع
                </Text>
              </View>
            </PressableScale>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

function NoProgram() {
  return (
    <Screen title="التمارين">
      <Card>
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Text variant="title" align="center">
            لا يوجد برنامج بعد
          </Text>
          <Text variant="body" color="textDim" align="center">
            أضف أيام برنامجك وتمارينه لتبدأ التسجيل.
          </Text>
          <Link href="/settings/program" asChild>
            <PressableScale haptic="light">
              <View style={{ paddingVertical: space.sm, paddingHorizontal: space.lg }}>
                <Text variant="heading" color="accent">
                  افتح محرّر البرنامج
                </Text>
              </View>
            </PressableScale>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

/* ---------------------------------------------------------------- modals */

function SetEditor({
  editing,
  onClose,
  onSave,
}: {
  editing: SetLog | null;
  onClose: () => void;
  onSave: (patch: { weightKg: number | null; reps: number | null }) => void;
}) {
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);

  // Seed the steppers from the set being opened.
  const seededFor = editing?.id ?? null;
  const [seed, setSeed] = useState<number | null>(null);
  if (seededFor !== seed) {
    setSeed(seededFor);
    setWeight(editing?.weightKg ?? null);
    setReps(editing?.reps ?? null);
  }

  return (
    <Modal visible={editing != null} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000AA',
          justifyContent: 'flex-end',
          padding: space.lg,
        }}
      >
        <Card raised>
          <View style={{ gap: space.xl }}>
            <Text variant="heading" align="center">
              تعديل المجموعة {editing ? n(editing.setNo) : ''}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Stepper label="الوزن" value={weight} suffix="كجم" step={2.5} onChange={setWeight} />
              <Stepper label="التكرارات" value={reps} step={1} decimals={0} onChange={setReps} />
            </View>

            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="إلغاء" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
              <Button
                title="حفظ"
                style={{ flex: 1 }}
                onPress={() => onSave({ weightKg: weight, reps })}
              />
            </View>
          </View>
        </Card>
        <View style={{ height: space.xl, backgroundColor: 'transparent' }} />
      </View>
    </Modal>
  );
}

function PrCelebration({ names, onDismiss }: { names: string[]; onDismiss: () => void }) {
  return (
    <Modal visible={names.length > 0} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000CC',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        <Card raised style={{ width: '100%' }}>
          <View style={{ gap: space.md, alignItems: 'center' }}>
            <Text variant="display" color="good">
              PR
            </Text>
            <Text variant="body" color="textDim" align="center">
              رقم شخصي جديد في
            </Text>
            {names.map((name) => (
              <Text key={name} variant="heading" align="center">
                {name}
              </Text>
            ))}
            <Button title="تمام" onPress={onDismiss} haptic="success" style={{ alignSelf: 'stretch' }} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
