/**
 * The real training program, as plain data.
 *
 * Source: the user's 5-day "Build muscle and get stronger" program.
 * Every exercise is 3 sets of 10 with 2 minutes rest, as prescribed — the only
 * exception is the plank, which the source gives as 3 × 60.
 *
 * Faithfulness notes:
 *
 * - Exercise names are kept in English exactly as the program writes them.
 *   Translating them would be altering the program, and gym equipment is
 *   labelled in English anyway. The Arabic muscle group goes in `notes`, so the
 *   training screen still reads in Arabic without the data being rewritten.
 * - `repMin` and `repMax` are both 10 because the program prescribes a flat 10,
 *   not a range. That makes every completed session qualify for a weight
 *   increase, which is the correct reading: finishing all 3 × 10 is exactly
 *   what "earned it" means under this program.
 * - The plank's unit is an assumption. The source says "تكرار: 60" with no
 *   unit; 60 seconds is overwhelmingly likely, and 60 plank repetitions is not
 *   a thing. Stored as seconds and flagged here rather than silently recorded
 *   as reps. One edit in the program editor changes it.
 * - The program does not say which weekdays are training days, so the schedule
 *   is deliberately left empty — see seedProgram in ./program.ts.
 *
 * No database imports: program-data.test.ts checks this under plain Node.
 */

import type { RepUnit } from '@/db/schema';

export type ExerciseSeed = {
  name: string;
  /** Muscle group as the program labels it, in Arabic, shown under the name. */
  notes: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  repUnit?: RepUnit;
};

export type ProgramDaySeed = {
  key: string;
  name: string;
  exercises: ExerciseSeed[];
};

/** Every exercise in this program shares these, so they are not repeated below. */
const SETS = 3;
const REPS = 10;
const REST_SEC = 120;

const ex = (name: string, notes: string, overrides: Partial<ExerciseSeed> = {}): ExerciseSeed => ({
  name,
  notes,
  sets: SETS,
  repMin: REPS,
  repMax: REPS,
  restSec: REST_SEC,
  ...overrides,
});

export const PROGRAM_DAYS: ProgramDaySeed[] = [
  {
    key: 'day01',
    name: 'Day 01 — Push',
    exercises: [
      ex('Chest Press (Machine)', 'صدر'),
      ex('Shoulder Press (Machine)', 'أكتاف'),
      ex('Pec Deck / Chest Fly (Machine)', 'صدر'),
      ex('Lateral Raise (Machine)', 'أكتاف'),
      ex('Triceps Pushdown (Cable)', 'ترايسبس'),
      ex('Overhead Cable Extension', 'ترايسبس'),
      ex('Cable Rope Crunches', 'بطن'),
    ],
  },
  {
    key: 'day02',
    name: 'Day 02 — Pull',
    exercises: [
      ex('Chest-Supported T-Bar Row', 'ظهر'),
      ex('Lat Pulldown (Machine)', 'ظهر'),
      ex('Cable Row (Close Grip)', 'وسط الظهر'),
      ex('Face Pull (Cable)', 'أكتاف'),
      ex('Preacher Curl (Machine)', 'بايسبس'),
      ex('Hyperextensions', 'أسفل الظهر'),
      ex('Hammer Curl (Cable or Dumbbell)', 'بايسبس'),
    ],
  },
  {
    key: 'day03',
    name: 'Day 03 — Legs',
    exercises: [
      ex('Leg Press (Machine)', 'أمامي الفخذ'),
      ex('Romanian Deadlift (Dumbbells)', 'مؤخرة وظهر'),
      ex('Leg Extension (Machine)', 'أمامي الفخذ'),
      ex('Leg Curl (Machine)', 'خلفي الفخذ'),
      ex('Seated Calf Raise (Machine)', 'سمانة'),
      // The source gives "60" with no unit — see the note at the top of the file.
      ex('Plank', 'بطن · المدة بالثواني', { repMin: 60, repMax: 60, repUnit: 'seconds' }),
    ],
  },
  {
    key: 'day04',
    name: 'Day 04 — Upper',
    exercises: [
      ex('Incline Chest Press (Machine)', 'صدر'),
      ex('Chest-Supported T-Bar Row', 'ظهر'),
      ex('Lateral Raise (Machine)', 'أكتاف'),
      ex('Lat Pulldown (Machine)', 'ظهر'),
      ex('Reverse Pec Deck', 'أكتاف'),
      ex('Overhead Triceps Extension', 'ترايسبس'),
      ex('Hammer Curl (Cable or Dumbbell)', 'بايسبس'),
      ex('Ab Crunch (Machine)', 'بطن'),
    ],
  },
  {
    key: 'day05',
    name: 'Day 05 — Legs',
    exercises: [
      ex('Hack Squat (Machine)', 'أمامي الفخذ'),
      ex('Lying Leg Curl', 'خلفي الفخذ'),
      ex('Leg Extension (Machine)', 'أمامي الفخذ'),
      ex('Hip Adduction (Machine)', 'مؤخرة / ورك / داخلي الفخذ'),
      ex('Seated Calf Raise (Machine)', 'سمانة'),
      ex('Hanging Leg Raises', 'بطن'),
    ],
  },
];

/** Stated in the program: 5 training days, 45 minutes each. */
export const TRAINING_DAYS_PER_WEEK = 5;
export const SESSION_MINUTES = 45;
