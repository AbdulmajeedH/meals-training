import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays,
  addMonths,
  daysBetween,
  fromIso,
  monthDates,
  startOfMonth,
  startOfWeek,
  toIso,
  weekDates,
  weekday,
} from './date.ts';

describe('toIso / fromIso', () => {
  it('uses local calendar components, not UTC', () => {
    // 23:30 local on the 10th is the 11th in UTC for anyone east of Greenwich.
    // toIso must still say the 10th.
    const late = new Date(2026, 8, 10, 23, 30);
    assert.equal(toIso(late), '2026-09-10');

    const early = new Date(2026, 8, 10, 0, 15);
    assert.equal(toIso(early), '2026-09-10');
  });

  it('round-trips', () => {
    assert.equal(toIso(fromIso('2026-02-28')), '2026-02-28');
  });

  it('pads single digits', () => {
    assert.equal(toIso(new Date(2026, 0, 5)), '2026-01-05');
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  });

  it('crosses year boundaries', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });

  it('goes backwards', () => {
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('handles leap years', () => {
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  });
});

describe('daysBetween', () => {
  it('counts forwards and backwards', () => {
    assert.equal(daysBetween('2026-09-01', '2026-09-10'), 9);
    assert.equal(daysBetween('2026-09-10', '2026-09-01'), -9);
    assert.equal(daysBetween('2026-09-10', '2026-09-10'), 0);
  });

  it('is exact across a month boundary', () => {
    assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29);
  });
});

describe('startOfWeek', () => {
  it('snaps back to Sunday', () => {
    // 2026-09-10 is a Thursday.
    assert.equal(weekday('2026-09-10'), 4);
    assert.equal(startOfWeek('2026-09-10'), '2026-09-06');
  });

  it('is idempotent on a Sunday', () => {
    assert.equal(startOfWeek('2026-09-06'), '2026-09-06');
  });

  it('does not jump back a week on Saturday', () => {
    assert.equal(weekday('2026-09-12'), 6);
    assert.equal(startOfWeek('2026-09-12'), '2026-09-06');
  });
});

describe('weekDates', () => {
  it('is seven consecutive days from the start', () => {
    const dates = weekDates('2026-09-06');
    assert.equal(dates.length, 7);
    assert.equal(dates[0], '2026-09-06');
    assert.equal(dates[6], '2026-09-12');
  });
});

describe('monthDates', () => {
  it('covers the whole month', () => {
    const september = monthDates('2026-09-17');
    assert.equal(september.length, 30);
    assert.equal(september[0], '2026-09-01');
    assert.equal(september[29], '2026-09-30');
  });

  it('gets February right in a leap year', () => {
    assert.equal(monthDates('2028-02-10').length, 29);
    assert.equal(monthDates('2026-02-10').length, 28);
  });
});

describe('startOfMonth / addMonths', () => {
  it('snaps to the first', () => {
    assert.equal(startOfMonth('2026-09-17'), '2026-09-01');
  });

  it('steps months without day overflow', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-01');
    assert.equal(addMonths('2026-01-15', -1), '2025-12-01');
  });
});
