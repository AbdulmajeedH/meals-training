import { and, desc, eq, ne, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  personalBests,
  programDays,
  programSchedule,
  setLogs,
  workoutSessions,
  type Exercise,
  type ProgramDay,
  type SessionStatus,
  type SetLog,
} from '@/db/schema';
import { type IsoDate, weekday } from '@/lib/date';
import {
  defaultFromLastSession,
  estimateOneRm,
  isPersonalBest,
  suggestNextWeight,
  type SetResult,
} from '@/lib/progression';

export type ExerciseWithSets = {
  exercise: Exercise;
  /** Full rows, so the UI has the set id to write back to. */
  sets: SetLog[];
  /** The heaviest completed set of the previous session with this exercise. */
  last: { weightKg: number | null; reps: number | null; date: IsoDate | null };
  /** Non-null when every set last time reached rep_max. */
  suggestion: number | null;
};

export type TodaySession =
  | { kind: 'rest' }
  | {
      kind: 'workout';
      session: typeof workoutSessions.$inferSelect;
      programDay: ProgramDay;
      items: ExerciseWithSets[];
    };

/* --------------------------------------------------------------- schedule */

export function programDayForDate(date: IsoDate): ProgramDay | null {
  const row = db
    .select({ day: programDays })
    .from(programSchedule)
    .innerJoin(programDays, eq(programSchedule.programDayId, programDays.id))
    .where(eq(programSchedule.weekday, weekday(date)))
    .get();

  return row?.day ?? null;
}

/* ---------------------------------------------------------------- session */

/**
 * The session row for a date, creating it — and its set rows — if this is the
 * first time the day is opened.
 *
 * Pre-filling is the whole point: every set arrives already carrying last
 * session's weight × reps, so a normal day is confirmed rather than typed.
 */
export function ensureSession(date: IsoDate): typeof workoutSessions.$inferSelect | null {
  const existing = db.select().from(workoutSessions).where(eq(workoutSessions.date, date)).get();
  if (existing) return existing;

  const day = programDayForDate(date);
  if (!day) return null;

  return db.transaction((tx) => {
    const session = tx
      .insert(workoutSessions)
      .values({ date, programDayId: day.id, status: 'planned' })
      .returning()
      .get();

    const planned = tx
      .select()
      .from(exercises)
      .where(and(eq(exercises.programDayId, day.id), eq(exercises.archived, false)))
      .orderBy(exercises.sort, exercises.id)
      .all();

    for (const exercise of planned) {
      const previous = lastSessionSets(exercise.id, date);
      const { weightKg, reps } = defaultFromLastSession(previous.sets);

      for (let setNo = 1; setNo <= exercise.sets; setNo++) {
        tx.insert(setLogs)
          .values({
            sessionId: session.id,
            exerciseId: exercise.id,
            setNo,
            weightKg,
            reps: reps ?? exercise.repMin,
            done: false,
          })
          .run();
      }
    }

    return session;
  });
}

/** Sets logged for an exercise in the most recent session strictly before `date`. */
export function lastSessionSets(
  exerciseId: number,
  before: IsoDate,
): { date: IsoDate | null; sets: SetResult[] } {
  const previousSession = db
    .select({ id: workoutSessions.id, date: workoutSessions.date })
    .from(workoutSessions)
    .innerJoin(setLogs, eq(setLogs.sessionId, workoutSessions.id))
    .where(and(eq(setLogs.exerciseId, exerciseId), sql`${workoutSessions.date} < ${before}`))
    .orderBy(desc(workoutSessions.date))
    .limit(1)
    .get();

  if (!previousSession) return { date: null, sets: [] };

  const sets = db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.sessionId, previousSession.id), eq(setLogs.exerciseId, exerciseId)))
    .orderBy(setLogs.setNo)
    .all();

  return { date: previousSession.date, sets };
}

export function getTodaySession(date: IsoDate): TodaySession {
  const session = ensureSession(date);
  if (!session) return { kind: 'rest' };

  const programDay = db
    .select()
    .from(programDays)
    .where(eq(programDays.id, session.programDayId))
    .get();

  if (!programDay) return { kind: 'rest' };

  const planned = db
    .select()
    .from(exercises)
    .where(and(eq(exercises.programDayId, programDay.id), eq(exercises.archived, false)))
    .orderBy(exercises.sort, exercises.id)
    .all();

  const items: ExerciseWithSets[] = planned.map((exercise) => {
    const sets = db
      .select()
      .from(setLogs)
      .where(and(eq(setLogs.sessionId, session.id), eq(setLogs.exerciseId, exercise.id)))
      .orderBy(setLogs.setNo)
      .all();

    const previous = lastSessionSets(exercise.id, date);

    return {
      exercise,
      sets,
      last: { ...defaultFromLastSession(previous.sets), date: previous.date },
      suggestion: suggestNextWeight(previous.sets, exercise.repMax, exercise.sets),
    };
  });

  return { kind: 'workout', session, programDay, items };
}

/* ----------------------------------------------------------------- writes */

/** Mark a set done or not-done, recording whatever weight × reps it carried. */
export function toggleSet(
  setId: number,
  patch: { weightKg?: number | null; reps?: number | null; done?: boolean },
): void {
  db.update(setLogs).set(patch).where(eq(setLogs.id, setId)).run();
}

export function updateSet(
  setId: number,
  patch: { weightKg?: number | null; reps?: number | null },
): void {
  db.update(setLogs).set(patch).where(eq(setLogs.id, setId)).run();
}

/** Apply a weight to every not-yet-done set of an exercise in this session. */
export function applyWeightToRemaining(
  sessionId: number,
  exerciseId: number,
  weightKg: number,
): void {
  db.update(setLogs)
    .set({ weightKg })
    .where(
      and(
        eq(setLogs.sessionId, sessionId),
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.done, false),
      ),
    )
    .run();
}

export function startSession(sessionId: number): void {
  db.update(workoutSessions)
    .set({ status: 'in_progress', startedAt: Date.now() })
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.status, 'planned')))
    .run();
}

export function setSessionStatus(sessionId: number, status: SessionStatus): void {
  db.update(workoutSessions)
    .set({
      status,
      finishedAt: status === 'completed' || status === 'skipped' ? Date.now() : null,
    })
    .where(eq(workoutSessions.id, sessionId))
    .run();
}

/**
 * Close out a session and fold its sets into the personal-best table.
 * Returns the exercises that set a new best, so the screen can celebrate them —
 * a PR is one of only two things worth celebrating.
 */
export function finishSession(sessionId: number, date: IsoDate): number[] {
  return db.transaction((tx) => {
    tx.update(workoutSessions)
      .set({ status: 'completed', finishedAt: Date.now() })
      .where(eq(workoutSessions.id, sessionId))
      .run();

    const done = tx
      .select()
      .from(setLogs)
      .where(and(eq(setLogs.sessionId, sessionId), eq(setLogs.done, true)))
      .all();

    const beaten: number[] = [];

    for (const set of done) {
      if (set.weightKg == null || set.reps == null) continue;

      const current = tx
        .select()
        .from(personalBests)
        .where(eq(personalBests.exerciseId, set.exerciseId))
        .get();

      if (!isPersonalBest(set.weightKg, set.reps, current?.estimatedOneRm ?? null)) continue;

      const estimated = estimateOneRm(set.weightKg, set.reps);
      tx.insert(personalBests)
        .values({
          exerciseId: set.exerciseId,
          weightKg: set.weightKg,
          reps: set.reps,
          estimatedOneRm: estimated,
          date,
        })
        .onConflictDoUpdate({
          target: personalBests.exerciseId,
          set: { weightKg: set.weightKg, reps: set.reps, estimatedOneRm: estimated, date },
        })
        .run();

      if (!beaten.includes(set.exerciseId)) beaten.push(set.exerciseId);
    }

    return beaten;
  });
}

/* ------------------------------------------------------------ program CRUD */

export function listProgramDays(): (ProgramDay & { exerciseCount: number })[] {
  const days = db
    .select()
    .from(programDays)
    .where(eq(programDays.archived, false))
    .orderBy(programDays.sort, programDays.id)
    .all();
  return days.map((day) => ({
    ...day,
    exerciseCount: db
      .select({ count: sql<number>`count(*)` })
      .from(exercises)
      .where(and(eq(exercises.programDayId, day.id), eq(exercises.archived, false)))
      .get()!.count,
  }));
}

export function listExercises(programDayId: number): Exercise[] {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.programDayId, programDayId), eq(exercises.archived, false)))
    .orderBy(exercises.sort, exercises.id)
    .all();
}

export function getSchedule(): { weekday: number; programDayId: number | null }[] {
  const rows = db.select().from(programSchedule).all();
  const byWeekday = new Map(rows.map((r) => [r.weekday, r.programDayId]));
  return Array.from({ length: 7 }, (_, weekdayIndex) => ({
    weekday: weekdayIndex,
    programDayId: byWeekday.get(weekdayIndex) ?? null,
  }));
}

export function setScheduleDay(weekdayIndex: number, programDayId: number | null): void {
  db.insert(programSchedule)
    .values({ weekday: weekdayIndex, programDayId })
    .onConflictDoUpdate({ target: programSchedule.weekday, set: { programDayId } })
    .run();
}

export function createProgramDay(name: string): ProgramDay {
  const max = db
    .select({ value: sql<number>`coalesce(max(${programDays.sort}), -1)` })
    .from(programDays)
    .get()!.value;

  return db.insert(programDays).values({ name, sort: max + 1 }).returning().get();
}

export function renameProgramDay(id: number, name: string): void {
  db.update(programDays).set({ name }).where(eq(programDays.id, id)).run();
}

export type DeleteResult = { ok: true } | { ok: false; reason: 'has_history' };

/**
 * Delete a program day only while it has no training history behind it.
 *
 * Once a session has been logged against the day, deleting would cascade
 * through its exercises into their set logs and erase what was actually
 * lifted. Archiving keeps the history readable and takes the day out of the
 * schedule, which is what "remove it" actually means here.
 */
export function deleteProgramDay(id: number): DeleteResult {
  const sessions = db
    .select({ count: sql<number>`count(*)` })
    .from(workoutSessions)
    .where(eq(workoutSessions.programDayId, id))
    .get()!.count;

  if (sessions > 0) return { ok: false, reason: 'has_history' };

  db.delete(programDays).where(eq(programDays.id, id)).run();
  return { ok: true };
}

export function archiveProgramDay(id: number, archived = true): void {
  db.transaction((tx) => {
    tx.update(programDays).set({ archived }).where(eq(programDays.id, id)).run();
    if (archived) {
      // A retired day must not stay on the weekly schedule.
      tx.update(programSchedule)
        .set({ programDayId: null })
        .where(eq(programSchedule.programDayId, id))
        .run();
    }
  });
}

export type ExerciseDraft = {
  id?: number;
  programDayId: number;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  notes: string | null;
};

export function upsertExercise(input: ExerciseDraft): void {
  if (input.id) {
    const { id, ...rest } = input;
    db.update(exercises).set(rest).where(eq(exercises.id, id)).run();
    return;
  }

  const max = db
    .select({ value: sql<number>`coalesce(max(${exercises.sort}), -1)` })
    .from(exercises)
    .where(eq(exercises.programDayId, input.programDayId))
    .get()!.value;

  db.insert(exercises).values({ ...input, sort: max + 1 }).run();
}

/** Same rule as program days: an exercise with logged sets is archived, not deleted. */
export function deleteExercise(id: number): DeleteResult {
  const logged = db
    .select({ count: sql<number>`count(*)` })
    .from(setLogs)
    .where(and(eq(setLogs.exerciseId, id), eq(setLogs.done, true)))
    .get()!.count;

  if (logged > 0) return { ok: false, reason: 'has_history' };

  db.delete(exercises).where(eq(exercises.id, id)).run();
  return { ok: true };
}

export function archiveExercise(id: number, archived = true): void {
  db.update(exercises).set({ archived }).where(eq(exercises.id, id)).run();
}

/** Whether any program has been entered yet — drives the empty state. */
export function hasProgram(): boolean {
  return (
    (db
      .select({ count: sql<number>`count(*)` })
      .from(programDays)
      .where(eq(programDays.archived, false))
      .get()?.count ?? 0) > 0
  );
}

/** Sessions completed in a date range, for the adherence score and heatmap. */
export function completedSessionDates(from: IsoDate, to: IsoDate): Set<IsoDate> {
  const rows = db
    .select({ date: workoutSessions.date })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.status, 'completed'),
        sql`${workoutSessions.date} >= ${from}`,
        sql`${workoutSessions.date} <= ${to}`,
      ),
    )
    .all();

  return new Set(rows.map((r) => r.date));
}

export function listPersonalBests(): (typeof personalBests.$inferSelect & { name: string })[] {
  return db
    .select({
      exerciseId: personalBests.exerciseId,
      weightKg: personalBests.weightKg,
      reps: personalBests.reps,
      estimatedOneRm: personalBests.estimatedOneRm,
      date: personalBests.date,
      name: exercises.name,
    })
    .from(personalBests)
    .innerJoin(exercises, eq(personalBests.exerciseId, exercises.id))
    .orderBy(desc(personalBests.date))
    .all();
}

/** Sessions that were scheduled but neither completed nor skipped. */
export function openSessions(): typeof workoutSessions.$inferSelect[] {
  return db
    .select()
    .from(workoutSessions)
    .where(and(ne(workoutSessions.status, 'completed'), ne(workoutSessions.status, 'skipped')))
    .all();
}
