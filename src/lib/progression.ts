/**
 * Progression rules for the workout screen.
 *
 * Two jobs: decide what weight × reps to pre-fill from the last session (the
 * "plan IS the log" default), and decide when a weight increase has been earned.
 */

/** Smallest jump that is actually loadable: a 1.25 kg plate on each side. */
export const DEFAULT_INCREMENT_KG = 2.5;

export type SetResult = {
  setNo: number;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
};

/**
 * Estimated one-rep max, Epley. Used only to rank sets against each other for
 * PR detection, so the absolute number matters less than it being monotonic in
 * both weight and reps.
 */
export function estimateOneRm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * The set to pre-fill new sets from: the heaviest completed set of the previous
 * session. Heaviest rather than last, so a drop set at the end of a session does
 * not quietly lower next week's starting weight.
 */
export function defaultFromLastSession(previous: SetResult[]): {
  weightKg: number | null;
  reps: number | null;
} {
  const completed = previous.filter((s) => s.done && s.weightKg != null && s.reps != null);
  if (completed.length === 0) return { weightKg: null, reps: null };

  let best = completed[0];
  for (const set of completed) {
    if (set.weightKg! > best.weightKg!) best = set;
  }
  return { weightKg: best.weightKg, reps: best.reps };
}

/**
 * True when every prescribed set was completed at or above `repMax`.
 *
 * Deliberately strict: a session with a missing set does not count, however good
 * the sets that were logged. `expectedSets` comes from the program, not from how
 * many rows happen to exist.
 */
export function allSetsAtRepMax(sets: SetResult[], repMax: number, expectedSets: number): boolean {
  const completed = sets.filter((s) => s.done && s.reps != null);
  if (completed.length < expectedSets) return false;
  return completed.slice(0, expectedSets).every((s) => (s.reps as number) >= repMax);
}

/**
 * The weight to suggest for the next session, or null when nothing was earned.
 * All sets have to be at the top of the rep range at the same working weight.
 */
export function suggestNextWeight(
  sets: SetResult[],
  repMax: number,
  expectedSets: number,
  increment: number = DEFAULT_INCREMENT_KG,
): number | null {
  if (!allSetsAtRepMax(sets, repMax, expectedSets)) return null;

  const weights = sets
    .filter((s) => s.done && s.weightKg != null)
    .slice(0, expectedSets)
    .map((s) => s.weightKg as number);

  if (weights.length < expectedSets) return null;

  // If the sets were not all at the same load, the top of the range was not
  // really hit at a single working weight — suggest nothing.
  const working = Math.min(...weights);
  if (Math.max(...weights) !== working) return null;

  return working + increment;
}

/** Is this set a new personal best against the stored one? */
export function isPersonalBest(
  weightKg: number,
  reps: number,
  currentBestOneRm: number | null,
): boolean {
  if (weightKg <= 0 || reps <= 0) return false;
  if (currentBestOneRm == null) return true;
  return estimateOneRm(weightKg, reps) > currentBestOneRm;
}
