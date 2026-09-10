import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentStreak,
  isPerfectWeek,
  movingAverage,
  scoreDay,
  weeklyWeightChange,
  type DayScore,
} from './adherence.ts';
import type { Macros } from './macros.ts';

const target: Macros = { kcal: 2500, proteinG: 105, carbsG: 340, fatG: 80 };
const macros = (kcal: number, proteinG: number): Macros => ({
  kcal,
  proteinG,
  carbsG: 0,
  fatG: 0,
});

describe('scoreDay', () => {
  it('gives a perfect day 100', () => {
    const score = scoreDay({ consumed: macros(2500, 105), target, workout: 'completed' });
    assert.equal(score.total, 100);
    assert.equal(score.scored, true);
  });

  it('awards a rest day the workout points automatically', () => {
    const score = scoreDay({ consumed: macros(2500, 105), target, workout: 'rest' });
    assert.equal(score.workout, 30);
    assert.equal(score.total, 100);
  });

  it('withholds the workout points when the session was missed', () => {
    const score = scoreDay({ consumed: macros(2500, 105), target, workout: 'missed' });
    assert.equal(score.workout, 0);
    assert.equal(score.total, 70);
  });

  describe('the calorie band', () => {
    it('includes exactly +10% and -10%', () => {
      assert.equal(scoreDay({ consumed: macros(2750, 105), target, workout: 'rest' }).kcal, 40);
      assert.equal(scoreDay({ consumed: macros(2250, 105), target, workout: 'rest' }).kcal, 40);
    });

    it('excludes just outside the band', () => {
      assert.equal(scoreDay({ consumed: macros(2751, 105), target, workout: 'rest' }).kcal, 0);
      assert.equal(scoreDay({ consumed: macros(2249, 105), target, workout: 'rest' }).kcal, 0);
    });

    it('penalises under-eating and over-eating alike', () => {
      const under = scoreDay({ consumed: macros(1500, 105), target, workout: 'rest' });
      const over = scoreDay({ consumed: macros(3500, 105), target, workout: 'rest' });
      assert.equal(under.kcal, 0);
      assert.equal(over.kcal, 0);
    });
  });

  describe('the protein floor', () => {
    it('includes exactly 90%', () => {
      assert.equal(scoreDay({ consumed: macros(2500, 94.5), target, workout: 'rest' }).protein, 30);
    });

    it('excludes just under 90%', () => {
      assert.equal(scoreDay({ consumed: macros(2500, 94.4), target, workout: 'rest' }).protein, 0);
    });

    it('does not penalise going over', () => {
      assert.equal(scoreDay({ consumed: macros(2500, 140), target, workout: 'rest' }).protein, 30);
    });
  });

  describe('missing targets', () => {
    it('marks the day unscored rather than zero', () => {
      const score = scoreDay({
        consumed: macros(2500, 105),
        target: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        workout: 'completed',
      });
      assert.equal(score.scored, false);
      assert.equal(score.total, 0);
    });

    it('does not award protein points for a zero protein target', () => {
      // Otherwise eating nothing would satisfy "90% of zero".
      const score = scoreDay({
        consumed: macros(2500, 0),
        target: { ...target, proteinG: 0 },
        workout: 'rest',
      });
      assert.equal(score.protein, 0);
    });
  });

  it('scores an untouched day at zero, not unscored', () => {
    const score = scoreDay({ consumed: macros(0, 0), target, workout: 'missed' });
    assert.equal(score.scored, true);
    assert.equal(score.total, 0);
  });
});

/* ------------------------------------------------------------------ streak */

const score = (total: number, scored = true): DayScore => ({
  total,
  kcal: 0,
  protein: 0,
  workout: 0,
  scored,
});

describe('currentStreak', () => {
  const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

  it('counts back from the most recent day', () => {
    const scores = new Map([
      [dates[0], score(50)],
      [dates[1], score(90)],
      [dates[2], score(100)],
      [dates[3], score(85)],
    ]);
    assert.equal(currentStreak(scores, dates), 3);
  });

  it('is zero when the latest day fell short', () => {
    const scores = new Map([
      [dates[0], score(100)],
      [dates[1], score(100)],
      [dates[2], score(100)],
      [dates[3], score(40)],
    ]);
    assert.equal(currentStreak(scores, dates), 0);
  });

  it('skips unscored days instead of breaking on them', () => {
    // A day before targets existed should not end a live streak.
    const scores = new Map([
      [dates[0], score(100)],
      [dates[1], score(0, false)],
      [dates[2], score(100)],
      [dates[3], score(100)],
    ]);
    assert.equal(currentStreak(scores, dates), 3);
  });

  it('is zero with no data', () => {
    assert.equal(currentStreak(new Map(), dates), 0);
  });
});

describe('isPerfectWeek', () => {
  it('needs all seven days at 100', () => {
    assert.equal(isPerfectWeek(Array.from({ length: 7 }, () => score(100))), true);
  });

  it('rejects a week with a 99', () => {
    const week = Array.from({ length: 7 }, () => score(100));
    week[3] = score(99);
    assert.equal(isPerfectWeek(week), false);
  });

  it('rejects a short week', () => {
    assert.equal(isPerfectWeek(Array.from({ length: 6 }, () => score(100))), false);
  });
});

/* ------------------------------------------------------------------ weight */

describe('movingAverage', () => {
  it('is empty for no readings', () => {
    assert.deepEqual(movingAverage([]), []);
  });

  it('returns a single reading unchanged', () => {
    assert.deepEqual(movingAverage([{ date: '2026-09-01', kg: 50 }]), [
      { date: '2026-09-01', kg: 50 },
    ]);
  });

  it('smooths a spike', () => {
    const points = [
      { date: '2026-09-01', kg: 50 },
      { date: '2026-09-02', kg: 50 },
      { date: '2026-09-03', kg: 56 },
      { date: '2026-09-04', kg: 50 },
      { date: '2026-09-05', kg: 50 },
    ];
    const smoothed = movingAverage(points);
    const spike = smoothed.find((p) => p.date === '2026-09-03')!;
    assert.ok(spike.kg < 56 && spike.kg > 50, `spike smoothed to ${spike.kg}`);
  });

  it('sorts unordered input', () => {
    const smoothed = movingAverage([
      { date: '2026-09-03', kg: 52 },
      { date: '2026-09-01', kg: 50 },
    ]);
    assert.equal(smoothed[0].date, '2026-09-01');
  });
});

describe('weeklyWeightChange', () => {
  it('is null with too few readings', () => {
    assert.equal(weeklyWeightChange([]), null);
    assert.equal(weeklyWeightChange([{ date: '2026-09-01', kg: 50 }]), null);
  });

  it('is null when the readings do not span a week', () => {
    assert.equal(
      weeklyWeightChange([
        { date: '2026-09-09', kg: 50 },
        { date: '2026-09-10', kg: 51 },
      ]),
      null,
    );
  });

  it('reports the gain across a week', () => {
    const points = Array.from({ length: 15 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      // A steady 100 g per day.
      kg: 50 + i * 0.1,
    }));
    const change = weeklyWeightChange(points);
    assert.ok(change != null);
    assert.ok(Math.abs(change - 0.7) < 0.05, `expected ~0.7 kg, got ${change}`);
  });
});
