// Explicit extension: this module is exercised by node --test, whose ESM
// resolver does not guess. Metro and tsc both accept it.
import { addDays, type IsoDate } from './date.ts';
import type { Macros } from './macros';

/**
 * The daily adherence score, 0–100.
 *
 *   40 pts — calories within ±10% of the day-type target
 *   30 pts — protein at or above 90% of target
 *   30 pts — the planned workout completed; a rest day scores this automatically
 *
 * All three are all-or-nothing on purpose. A score that slides smoothly invites
 * negotiating with yourself about how close is close enough; a threshold does not.
 *
 * Busy mode changes which target is used, not how the day is scored — a busy day
 * still counts, which is the point of having one.
 */

export const KCAL_TOLERANCE = 0.1;
export const PROTEIN_FLOOR = 0.9;

export const KCAL_POINTS = 40;
export const PROTEIN_POINTS = 30;
export const WORKOUT_POINTS = 30;

/** A day at or above this continues a streak. */
export const STREAK_THRESHOLD = 80;

export type WorkoutOutcome = 'completed' | 'missed' | 'rest';

export type DayScore = {
  total: number;
  kcal: number;
  protein: number;
  workout: number;
  /**
   * False when no target is set for the day, which makes the score meaningless
   * rather than zero. Callers should show these days as blank, not as failures.
   */
  scored: boolean;
};

const UNSCORED: DayScore = { total: 0, kcal: 0, protein: 0, workout: 0, scored: false };

export function scoreDay(input: {
  consumed: Macros;
  target: Macros;
  workout: WorkoutOutcome;
}): DayScore {
  const { consumed, target, workout } = input;

  if (!(target.kcal > 0)) return UNSCORED;

  const drift = Math.abs(consumed.kcal - target.kcal) / target.kcal;
  const kcal = drift <= KCAL_TOLERANCE ? KCAL_POINTS : 0;

  // A zero protein target would otherwise award the points for eating nothing.
  const protein =
    target.proteinG > 0 && consumed.proteinG >= target.proteinG * PROTEIN_FLOOR
      ? PROTEIN_POINTS
      : 0;

  const workoutScore = workout === 'missed' ? 0 : WORKOUT_POINTS;

  return {
    total: kcal + protein + workoutScore,
    kcal,
    protein,
    workout: workoutScore,
    scored: true,
  };
}

/**
 * Consecutive scored days at or above the threshold, counting back from `from`.
 *
 * Days with no score break nothing and count for nothing — they are skipped, so
 * a day before targets existed does not end an otherwise live streak.
 */
export function currentStreak(
  scores: Map<IsoDate, DayScore>,
  dates: IsoDate[],
  threshold = STREAK_THRESHOLD,
): number {
  let streak = 0;
  // `dates` is oldest-first; walk backwards from the most recent.
  for (let i = dates.length - 1; i >= 0; i--) {
    const score = scores.get(dates[i]);
    if (!score || !score.scored) continue;
    if (score.total >= threshold) streak++;
    else break;
  }
  return streak;
}

/** Every scored day in the week hit 100. Worth celebrating; nothing else is. */
export function isPerfectWeek(scores: DayScore[]): boolean {
  const scored = scores.filter((s) => s.scored);
  return scored.length === 7 && scored.every((s) => s.total === 100);
}

/**
 * Centred moving average of body weight.
 *
 * A single morning reading is noise — water, salt, timing. The plan says to
 * compare weekly averages, so that is what the trend line shows.
 *
 * Uses whatever readings fall inside the window rather than requiring a full
 * one, so the line starts at the first reading instead of a week later.
 */
export function movingAverage(
  points: { date: IsoDate; kg: number }[],
  windowDays = 7,
): { date: IsoDate; kg: number }[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(windowDays / 2);

  return sorted.map((point, index) => {
    const from = Math.max(0, index - half);
    const to = Math.min(sorted.length - 1, index + half);
    let total = 0;
    for (let i = from; i <= to; i++) total += sorted[i].kg;
    return { date: point.date, kg: total / (to - from + 1) };
  });
}

/**
 * Change between this week's mean weight and the previous week's.
 *
 * Deliberately NOT a difference of two `movingAverage` values. That average is
 * centred, so its window is truncated at the most recent point — which is
 * precisely the value being read. On a steadily rising series the newest
 * smoothed point sits below the true trend, and the reported gain comes out
 * roughly a fifth short.
 *
 * Comparing two trailing weekly means is both unbiased at the end and exactly
 * what the plan asks for: compare the weekly average, not a single morning.
 *
 * Returns null unless both weeks actually contain readings.
 */
export function weeklyWeightChange(
  points: { date: IsoDate; kg: number }[],
  asOf?: IsoDate,
): number | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asOf ?? sorted[sorted.length - 1].date;

  const thisWeekFrom = addDays(latest, -6);
  const lastWeekFrom = addDays(latest, -13);

  const mean = (from: IsoDate, to: IsoDate): number | null => {
    const inRange = sorted.filter((p) => p.date >= from && p.date <= to);
    if (inRange.length === 0) return null;
    return inRange.reduce((total, p) => total + p.kg, 0) / inRange.length;
  };

  const thisWeek = mean(thisWeekFrom, latest);
  const lastWeek = mean(lastWeekFrom, addDays(thisWeekFrom, -1));

  if (thisWeek == null || lastWeek == null) return null;
  return thisWeek - lastWeek;
}

export const MISSED_REASON_LABEL_AR = {
  travel: 'سفر',
  work: 'شغل',
  no_food: 'ما توفّر أكل',
  tired: 'تعب',
  other: 'غير ذلك',
} as const;
