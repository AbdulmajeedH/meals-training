/**
 * Writes the training program (src/db/seed/program-data.ts) into the database.
 *
 * The weekly schedule is deliberately NOT seeded. The program says five
 * training days but never says which weekdays, so any mapping would be
 * invented. `program_schedule` is left empty and the training screen tells the
 * user to pick their days — see hasSchedule below.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, programDays, programSchedule, settings } from '@/db/schema';

import { PROGRAM_DAYS } from './program-data';

const SEED_KEY = 'program_seed_version';
const SEED_VERSION = '1';

export function isProgramSeeded(): boolean {
  return db.select().from(settings).where(eq(settings.key, SEED_KEY)).get()?.value === SEED_VERSION;
}

/**
 * Write the program into an empty database.
 *
 * Guarded the same way as the nutrition seed: a version flag, plus a refusal to
 * run when any program day already exists, so it can never overwrite edits.
 */
export function seedProgram(): { seeded: boolean; reason?: 'already' | 'not_empty' } {
  if (isProgramSeeded()) return { seeded: false, reason: 'already' };

  const existing = db.select({ id: programDays.id }).from(programDays).limit(1).all();
  if (existing.length > 0) return { seeded: false, reason: 'not_empty' };

  db.transaction((tx) => {
    PROGRAM_DAYS.forEach((day, dayIndex) => {
      const id = tx
        .insert(programDays)
        .values({ name: day.name, sort: dayIndex })
        .returning({ id: programDays.id })
        .get().id;

      day.exercises.forEach((exercise, index) => {
        tx.insert(exercises)
          .values({
            programDayId: id,
            name: exercise.name,
            sets: exercise.sets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSec: exercise.restSec,
            repUnit: exercise.repUnit ?? 'reps',
            notes: exercise.notes,
            sort: index,
          })
          .run();
      });
    });

    tx.insert(settings)
      .values({ key: SEED_KEY, value: SEED_VERSION })
      .onConflictDoUpdate({ target: settings.key, set: { value: SEED_VERSION } })
      .run();
  });

  return { seeded: true };
}

/**
 * Whether any weekday has been assigned a program day.
 *
 * Distinguishes "you have not chosen your training days yet" from "today is a
 * rest day" — without this the training screen would claim every day is a rest
 * day and give the user nothing to act on.
 */
export function hasSchedule(): boolean {
  return (
    db.select().from(programSchedule).all().filter((row) => row.programDayId != null).length > 0
  );
}
