import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allSetsAtRepMax,
  defaultFromLastSession,
  estimateOneRm,
  isPersonalBest,
  suggestNextWeight,
  type SetResult,
} from './progression.ts';

const set = (setNo: number, weightKg: number | null, reps: number | null, done = true): SetResult => ({
  setNo,
  weightKg,
  reps,
  done,
});

describe('estimateOneRm', () => {
  it('returns the weight itself for a single', () => {
    assert.equal(estimateOneRm(100, 1), 100);
  });

  it('grows with reps and with weight', () => {
    assert.ok(estimateOneRm(100, 5) > estimateOneRm(100, 3));
    assert.ok(estimateOneRm(110, 5) > estimateOneRm(100, 5));
  });

  it('is zero for nonsense input', () => {
    assert.equal(estimateOneRm(0, 5), 0);
    assert.equal(estimateOneRm(100, 0), 0);
  });
});

describe('defaultFromLastSession', () => {
  it('is empty when nothing was completed', () => {
    assert.deepEqual(defaultFromLastSession([]), { weightKg: null, reps: null });
    assert.deepEqual(defaultFromLastSession([set(1, 80, 8, false)]), {
      weightKg: null,
      reps: null,
    });
  });

  it('takes the heaviest set, not the last one', () => {
    // A drop set at the end must not lower next session's starting weight.
    const previous = [set(1, 80, 8), set(2, 80, 8), set(3, 60, 12)];
    assert.deepEqual(defaultFromLastSession(previous), { weightKg: 80, reps: 8 });
  });

  it('ignores sets that were never filled in', () => {
    const previous = [set(1, null, null), set(2, 70, 10)];
    assert.deepEqual(defaultFromLastSession(previous), { weightKg: 70, reps: 10 });
  });
});

describe('allSetsAtRepMax', () => {
  it('is true when every prescribed set reached the top of the range', () => {
    assert.equal(allSetsAtRepMax([set(1, 80, 12), set(2, 80, 12), set(3, 80, 12)], 12, 3), true);
  });

  it('is true when reps exceeded rep_max', () => {
    assert.equal(allSetsAtRepMax([set(1, 80, 13), set(2, 80, 12)], 12, 2), true);
  });

  it('is false when one set fell short', () => {
    assert.equal(allSetsAtRepMax([set(1, 80, 12), set(2, 80, 11), set(3, 80, 12)], 12, 3), false);
  });

  it('is false when a prescribed set is missing entirely', () => {
    assert.equal(allSetsAtRepMax([set(1, 80, 12), set(2, 80, 12)], 12, 3), false);
  });

  it('does not count undone sets', () => {
    assert.equal(allSetsAtRepMax([set(1, 80, 12), set(2, 80, 12, false)], 12, 2), false);
  });
});

describe('suggestNextWeight', () => {
  it('adds one increment when the range was topped out', () => {
    const sets = [set(1, 80, 12), set(2, 80, 12), set(3, 80, 12)];
    assert.equal(suggestNextWeight(sets, 12, 3), 82.5);
  });

  it('honours a custom increment', () => {
    const sets = [set(1, 100, 8), set(2, 100, 8)];
    assert.equal(suggestNextWeight(sets, 8, 2, 5), 105);
  });

  it('suggests nothing when the range was not topped out', () => {
    assert.equal(suggestNextWeight([set(1, 80, 12), set(2, 80, 10)], 12, 2), null);
  });

  it('suggests nothing when the sets were at different loads', () => {
    // Topping out at 60 kg after a heavy 80 kg set is not an earned increase.
    const sets = [set(1, 80, 12), set(2, 60, 12)];
    assert.equal(suggestNextWeight(sets, 12, 2), null);
  });
});

describe('isPersonalBest', () => {
  it('is true when there is no record yet', () => {
    assert.equal(isPersonalBest(60, 5, null), true);
  });

  it('compares on estimated 1RM, not raw weight', () => {
    const current = estimateOneRm(100, 5);
    assert.equal(isPersonalBest(100, 6, current), true);
    assert.equal(isPersonalBest(100, 4, current), false);
    // Heavier but far fewer reps can still be a lower estimated max.
    assert.equal(isPersonalBest(105, 1, current), false);
  });

  it('rejects empty sets', () => {
    assert.equal(isPersonalBest(0, 5, null), false);
    assert.equal(isPersonalBest(80, 0, null), false);
  });
});
