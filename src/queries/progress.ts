import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { bodyWeight, weeklyReviews, workoutSessions, type MissedReason } from '@/db/schema';
import { monthDates, startOfWeek, today, weekDates, type IsoDate } from '@/lib/date';
import { scoreDay, type DayScore, type WorkoutOutcome } from '@/lib/adherence';
import { getDayLog, getTarget } from './meals';
import { programDayForDate } from './training';

export type ScoredDay = { date: IsoDate; score: DayScore };

/**
 * How the day's workout ended.
 *
 * A scheduled session that is still open counts as missed only once the day is
 * over — otherwise today would score badly all morning, which is exactly the
 * kind of nagging that makes an adherence app get deleted.
 */
function workoutOutcome(date: IsoDate, now: IsoDate): WorkoutOutcome {
  const scheduled = programDayForDate(date) != null;
  if (!scheduled) return 'rest';

  const session = db.select().from(workoutSessions).where(eq(workoutSessions.date, date)).get();
  if (session?.status === 'completed') return 'completed';
  if (date >= now) return 'completed'; // today is not a failure yet
  return 'missed';
}

export function scoreForDate(date: IsoDate, now: IsoDate = today()): DayScore {
  const isTrainingDay = programDayForDate(date) != null;
  const day = getDayLog(date, isTrainingDay);
  return scoreDay({
    consumed: day.consumed,
    target: day.target.kcal > 0 ? day.target : getTarget(day.dayType),
    workout: workoutOutcome(date, now),
  });
}

/** Scores for a whole month, for the heatmap. Future days are left unscored. */
export function scoresForMonth(anyDateInMonth: IsoDate, now: IsoDate = today()): ScoredDay[] {
  return monthDates(anyDateInMonth).map((date) => ({
    date,
    score:
      date > now
        ? { total: 0, kcal: 0, protein: 0, workout: 0, scored: false }
        : scoreForDate(date, now),
  }));
}

export function scoresForWeek(weekStart: IsoDate, now: IsoDate = today()): ScoredDay[] {
  return weekDates(weekStart).map((date) => ({
    date,
    score:
      date > now
        ? { total: 0, kcal: 0, protein: 0, workout: 0, scored: false }
        : scoreForDate(date, now),
  }));
}

/* ------------------------------------------------------------------ weight */

export function listWeights(limit = 120): { date: IsoDate; kg: number }[] {
  return db
    .select()
    .from(bodyWeight)
    .orderBy(desc(bodyWeight.date))
    .limit(limit)
    .all()
    .reverse();
}

export function recordWeight(date: IsoDate, kg: number): void {
  db.insert(bodyWeight)
    .values({ date, kg })
    .onConflictDoUpdate({ target: bodyWeight.date, set: { kg } })
    .run();
}

export function deleteWeight(date: IsoDate): void {
  db.delete(bodyWeight).where(eq(bodyWeight.date, date)).run();
}

export function latestWeight(): { date: IsoDate; kg: number } | null {
  return db.select().from(bodyWeight).orderBy(desc(bodyWeight.date)).limit(1).get() ?? null;
}

/* --------------------------------------------------------- weekly reviews */

export type Review = {
  weekStart: IsoDate;
  missedReasons: MissedReason[];
  note: string | null;
};

export function getReview(weekStart: IsoDate): Review {
  const row = db.select().from(weeklyReviews).where(eq(weeklyReviews.weekStart, weekStart)).get();
  if (!row) return { weekStart, missedReasons: [], note: null };

  let reasons: MissedReason[] = [];
  try {
    const parsed: unknown = JSON.parse(row.missedReasons);
    if (Array.isArray(parsed)) reasons = parsed as MissedReason[];
  } catch {
    // A malformed blob should not take down the screen; treat it as no reasons.
  }

  return { weekStart, missedReasons: reasons, note: row.note };
}

export function saveReview(
  weekStart: IsoDate,
  missedReasons: MissedReason[],
  note: string | null,
): void {
  const payload = JSON.stringify(missedReasons);
  db.insert(weeklyReviews)
    .values({ weekStart, missedReasons: payload, note })
    .onConflictDoUpdate({
      target: weeklyReviews.weekStart,
      set: { missedReasons: payload, note },
    })
    .run();
}

export function toggleReviewReason(weekStart: IsoDate, reason: MissedReason): void {
  const review = getReview(weekStart);
  const next = review.missedReasons.includes(reason)
    ? review.missedReasons.filter((r) => r !== reason)
    : [...review.missedReasons, reason];
  saveReview(weekStart, next, review.note);
}

export function hasReviewedWeek(weekStart: IsoDate): boolean {
  return (
    (db
      .select({ count: sql<number>`count(*)` })
      .from(weeklyReviews)
      .where(eq(weeklyReviews.weekStart, weekStart))
      .get()?.count ?? 0) > 0
  );
}

/** The week that is due for review: the one containing today. */
export function currentReviewWeek(now: IsoDate = today()): IsoDate {
  return startOfWeek(now);
}

/* ------------------------------------------------------------- completion */

export function completedSessionCount(from: IsoDate, to: IsoDate): number {
  return (
    db
      .select({ count: sql<number>`count(*)` })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.status, 'completed'),
          sql`${workoutSessions.date} >= ${from}`,
          sql`${workoutSessions.date} <= ${to}`,
        ),
      )
      .get()?.count ?? 0
  );
}
