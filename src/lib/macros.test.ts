import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  add,
  kcalFromMacros,
  ratio,
  remaining,
  scale,
  subtract,
  sum,
  ZERO,
  type Macros,
} from './macros.ts';

const chicken: Macros = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const rice: Macros = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

describe('scale', () => {
  it('multiplies every macro', () => {
    assert.deepEqual(scale(rice, 2), { kcal: 260, proteinG: 5.4, carbsG: 56, fatG: 0.6 });
  });

  it('handles fractional servings', () => {
    const half = scale(chicken, 0.5);
    assert.equal(half.kcal, 82.5);
    assert.equal(half.proteinG, 15.5);
  });

  it('zero servings is zero', () => {
    assert.deepEqual(scale(chicken, 0), ZERO);
  });
});

describe('sum', () => {
  it('is zero for an empty plate', () => {
    assert.deepEqual(sum([]), ZERO);
  });

  it('adds foods at their serving counts', () => {
    const total = sum([
      { macros: chicken, servings: 2 },
      { macros: rice, servings: 1.5 },
    ]);
    assert.equal(total.kcal, 165 * 2 + 130 * 1.5);
    assert.equal(Math.round(total.proteinG * 10) / 10, 66.1);
    assert.equal(total.carbsG, 42);
  });

  it('aggregates the same food appearing twice', () => {
    const once = sum([{ macros: rice, servings: 2 }]);
    const twice = sum([
      { macros: rice, servings: 1 },
      { macros: rice, servings: 1 },
    ]);
    assert.deepEqual(once, twice);
  });
});

describe('add / subtract', () => {
  it('round-trips within float tolerance', () => {
    // Binary floats do not round-trip exactly (3.6 + 0.3 - 0.3 !== 3.6), which
    // is fine: macros are rounded for display, never compared for equality.
    const back = subtract(add(chicken, rice), rice);
    for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) {
      assert.ok(Math.abs(back[key] - chicken[key]) < 1e-9, key);
    }
  });
});

describe('remaining', () => {
  const target: Macros = { kcal: 2400, proteinG: 180, carbsG: 250, fatG: 70 };

  it('reports what is left', () => {
    const left = remaining(target, { kcal: 1000, proteinG: 90, carbsG: 100, fatG: 30 });
    assert.deepEqual(left, { kcal: 1400, proteinG: 90, carbsG: 150, fatG: 40 });
  });

  it('clamps at zero rather than going negative', () => {
    const left = remaining(target, { kcal: 2600, proteinG: 200, carbsG: 300, fatG: 80 });
    assert.deepEqual(left, ZERO);
  });

  it('clamps each macro independently', () => {
    // Over on protein, still under on calories.
    const left = remaining(target, { kcal: 1000, proteinG: 200, carbsG: 100, fatG: 30 });
    assert.equal(left.proteinG, 0);
    assert.equal(left.kcal, 1400);
  });
});

describe('ratio', () => {
  it('is the fraction consumed', () => {
    assert.equal(ratio(1200, 2400), 0.5);
  });

  it('can exceed one', () => {
    assert.equal(ratio(3000, 2400), 1.25);
  });

  it('never divides by zero', () => {
    assert.equal(ratio(1200, 0), 0);
    assert.equal(ratio(1200, Number.NaN), 0);
    assert.equal(ratio(1200, -100), 0);
  });
});

describe('kcalFromMacros', () => {
  it('uses 4/4/9', () => {
    assert.equal(kcalFromMacros({ kcal: 0, proteinG: 10, carbsG: 10, fatG: 10 }), 170);
  });
});
