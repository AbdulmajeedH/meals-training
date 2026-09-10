/**
 * Macro arithmetic. Everything the app shows about food ultimately comes
 * through here, so the rounding rules live in one place.
 */

export type Macros = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export type Servable = { macros: Macros; servings: number };

export function scale(macros: Macros, servings: number): Macros {
  return {
    kcal: macros.kcal * servings,
    proteinG: macros.proteinG * servings,
    carbsG: macros.carbsG * servings,
    fatG: macros.fatG * servings,
  };
}

export function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function subtract(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal - b.kcal,
    proteinG: a.proteinG - b.proteinG,
    carbsG: a.carbsG - b.carbsG,
    fatG: a.fatG - b.fatG,
  };
}

/** Total of a list of foods at their serving counts. */
export function sum(items: Servable[]): Macros {
  return items.reduce((total, item) => add(total, scale(item.macros, item.servings)), ZERO);
}

/**
 * What is left of a target. Clamped at zero, because the home screen answers
 * "what's left to eat", and a negative number there is noise — going over is
 * shown by the ring instead.
 */
export function remaining(target: Macros, consumed: Macros): Macros {
  const left = subtract(target, consumed);
  return {
    kcal: Math.max(0, left.kcal),
    proteinG: Math.max(0, left.proteinG),
    carbsG: Math.max(0, left.carbsG),
    fatG: Math.max(0, left.fatG),
  };
}

/**
 * Fraction of a target consumed. Can exceed 1 — the caller decides whether
 * overshooting is shown as a full ring or an over-target colour.
 * A zero or missing target yields 0 rather than dividing by zero.
 */
export function ratio(consumed: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return consumed / target;
}

/** Calories implied by the macros, at 4/4/9. Used to sanity-check food entries. */
export function kcalFromMacros(macros: Macros): number {
  return macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
}
