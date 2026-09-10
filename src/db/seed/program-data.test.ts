import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROGRAM_DAYS, TRAINING_DAYS_PER_WEEK } from './program-data.ts';

/**
 * Guards the program against drift from the source document. The prescription
 * is uniform — 3 sets, 10 reps, 2 minutes — so a stray value is almost always a
 * transcription mistake rather than an intended change.
 */

describe('program structure', () => {
  it('has the five days the program prescribes', () => {
    assert.equal(PROGRAM_DAYS.length, TRAINING_DAYS_PER_WEEK);
  });

  it('has no duplicate day keys', () => {
    assert.equal(new Set(PROGRAM_DAYS.map((d) => d.key)).size, PROGRAM_DAYS.length);
  });

  it('matches the exercise count of each day in the source', () => {
    assert.deepEqual(
      PROGRAM_DAYS.map((day) => day.exercises.length),
      [7, 7, 6, 8, 6],
    );
  });

  it('never repeats an exercise within a day', () => {
    for (const day of PROGRAM_DAYS) {
      const names = day.exercises.map((e) => e.name);
      assert.equal(new Set(names).size, names.length, `${day.key} repeats an exercise`);
    }
  });
});

describe('prescription', () => {
  it('is 3 sets and 2 minutes rest everywhere', () => {
    for (const day of PROGRAM_DAYS) {
      for (const exercise of day.exercises) {
        assert.equal(exercise.sets, 3, `${exercise.name} sets`);
        assert.equal(exercise.restSec, 120, `${exercise.name} rest`);
      }
    }
  });

  it('is a flat 10 reps for every exercise except the plank', () => {
    for (const day of PROGRAM_DAYS) {
      for (const exercise of day.exercises) {
        if (exercise.repUnit === 'seconds') continue;
        assert.equal(exercise.repMin, 10, `${exercise.name} repMin`);
        assert.equal(exercise.repMax, 10, `${exercise.name} repMax`);
      }
    }
  });

  it('gives every exercise a valid range', () => {
    for (const day of PROGRAM_DAYS) {
      for (const exercise of day.exercises) {
        assert.ok(exercise.repMax >= exercise.repMin, `${exercise.name} range is inverted`);
        assert.ok(exercise.repMin > 0, `${exercise.name} repMin must be positive`);
      }
    }
  });

  it('records the plank as a 60 second hold, not 60 reps', () => {
    const plank = PROGRAM_DAYS.flatMap((d) => d.exercises).find((e) => e.name === 'Plank');
    assert.ok(plank, 'plank is missing');
    assert.equal(plank.repUnit, 'seconds');
    assert.equal(plank.repMin, 60);
    assert.equal(plank.repMax, 60);
  });

  it('leaves every other exercise in reps', () => {
    const timed = PROGRAM_DAYS.flatMap((d) => d.exercises).filter((e) => e.repUnit === 'seconds');
    assert.deepEqual(timed.map((e) => e.name), ['Plank']);
  });

  it('labels every exercise with a muscle group', () => {
    for (const day of PROGRAM_DAYS) {
      for (const exercise of day.exercises) {
        assert.ok(exercise.notes.trim().length > 0, `${exercise.name} has no muscle group`);
      }
    }
  });
});
