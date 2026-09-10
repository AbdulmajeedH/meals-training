import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  dayTemplateSlots,
  dayTemplates,
  foods,
  mealItems,
  mealLogItems,
  mealLogs,
  meals,
  targets,
  weekPlan,
  type DayType,
  type Food,
  type Meal,
  type MealLog,
  type MealStatus,
} from '@/db/schema';
import type { IsoDate } from '@/lib/date';
import { sum, ZERO, type Macros } from '@/lib/macros';
import { MEAL_SLOTS, slotOrder, type MealSlot } from '@/lib/slots';

export type FoodPortion = { food: Food; servings: number };

export type MealWithMacros = Meal & {
  items: FoodPortion[];
  macros: Macros;
};

/** One slot of a day: what was planned, what happened, and what it costs. */
export type DaySlot = {
  slot: MealSlot;
  log: MealLog | null;
  plannedMeal: MealWithMacros | null;
  /** What actually counts towards the day — planned meal, or the edited items. */
  actual: FoodPortion[];
  macros: Macros;
  status: MealStatus;
};

export type DayLog = {
  date: IsoDate;
  dayType: DayType;
  isBusy: boolean;
  slots: DaySlot[];
  consumed: Macros;
  target: Macros;
};

const macrosOf = (food: Food): Macros => ({
  kcal: food.kcal,
  proteinG: food.proteinG,
  carbsG: food.carbsG,
  fatG: food.fatG,
});

const portionsToMacros = (portions: FoodPortion[]): Macros =>
  sum(portions.map((p) => ({ macros: macrosOf(p.food), servings: p.servings })));

/* -------------------------------------------------------------------- foods */

export function listFoods(includeArchived = false): Food[] {
  if (includeArchived) return db.select().from(foods).orderBy(asc(foods.nameAr)).all();
  return db.select().from(foods).where(eq(foods.archived, false)).orderBy(asc(foods.nameAr)).all();
}

export type FoodDraft = {
  id?: number;
  nameAr: string;
  servingLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function upsertFood(draft: FoodDraft): number {
  if (draft.id) {
    const { id, ...rest } = draft;
    db.update(foods).set(rest).where(eq(foods.id, id)).run();
    return id;
  }
  return db.insert(foods).values(draft).returning({ id: foods.id }).get().id;
}

export type DeleteResult = { ok: true } | { ok: false; reason: 'in_use' };

/**
 * Foods are referenced by meals and by logged days with ON DELETE RESTRICT, so
 * a food that has ever been eaten is archived rather than deleted — otherwise
 * past days would silently change their macros.
 */
export function deleteFood(id: number): DeleteResult {
  const usedInMeals = db
    .select({ count: sql<number>`count(*)` })
    .from(mealItems)
    .where(eq(mealItems.foodId, id))
    .get()!.count;

  const usedInLogs = db
    .select({ count: sql<number>`count(*)` })
    .from(mealLogItems)
    .where(eq(mealLogItems.foodId, id))
    .get()!.count;

  if (usedInMeals + usedInLogs > 0) return { ok: false, reason: 'in_use' };

  db.delete(foods).where(eq(foods.id, id)).run();
  return { ok: true };
}

export function archiveFood(id: number, archived = true): void {
  db.update(foods).set({ archived }).where(eq(foods.id, id)).run();
}

/* ------------------------------------------------------------ meal library */

function itemsForMeals(mealIds: number[]): Map<number, FoodPortion[]> {
  const byMeal = new Map<number, FoodPortion[]>();
  if (mealIds.length === 0) return byMeal;

  const rows = db
    .select({ mealId: mealItems.mealId, servings: mealItems.servings, food: foods })
    .from(mealItems)
    .innerJoin(foods, eq(mealItems.foodId, foods.id))
    .where(inArray(mealItems.mealId, mealIds))
    .orderBy(mealItems.sort, mealItems.id)
    .all();

  for (const row of rows) {
    const list = byMeal.get(row.mealId) ?? [];
    list.push({ food: row.food, servings: row.servings });
    byMeal.set(row.mealId, list);
  }
  return byMeal;
}

export function listMeals(includeArchived = false): MealWithMacros[] {
  const rows = includeArchived
    ? db.select().from(meals).orderBy(asc(meals.nameAr)).all()
    : db.select().from(meals).where(eq(meals.archived, false)).orderBy(asc(meals.nameAr)).all();

  const byMeal = itemsForMeals(rows.map((m) => m.id));

  return rows.map((meal) => {
    const items = byMeal.get(meal.id) ?? [];
    return { ...meal, items, macros: portionsToMacros(items) };
  });
}

export function getMeal(id: number): MealWithMacros | null {
  const meal = db.select().from(meals).where(eq(meals.id, id)).get();
  if (!meal) return null;
  const items = itemsForMeals([id]).get(id) ?? [];
  return { ...meal, items, macros: portionsToMacros(items) };
}

export function createMeal(nameAr: string, items: { foodId: number; servings: number }[]): number {
  return db.transaction((tx) => {
    const id = tx.insert(meals).values({ nameAr }).returning({ id: meals.id }).get().id;
    items.forEach((item, index) => {
      tx.insert(mealItems)
        .values({ mealId: id, foodId: item.foodId, servings: item.servings, sort: index })
        .run();
    });
    return id;
  });
}

export function updateMeal(
  id: number,
  nameAr: string,
  items: { foodId: number; servings: number }[],
): void {
  db.transaction((tx) => {
    tx.update(meals).set({ nameAr }).where(eq(meals.id, id)).run();
    tx.delete(mealItems).where(eq(mealItems.mealId, id)).run();
    items.forEach((item, index) => {
      tx.insert(mealItems)
        .values({ mealId: id, foodId: item.foodId, servings: item.servings, sort: index })
        .run();
    });
  });
}

export function deleteMeal(id: number): DeleteResult {
  const usedInPlans = db
    .select({ count: sql<number>`count(*)` })
    .from(dayTemplateSlots)
    .where(eq(dayTemplateSlots.mealId, id))
    .get()!.count;

  if (usedInPlans > 0) return { ok: false, reason: 'in_use' };

  // Logs reference meals with ON DELETE SET NULL, so history survives; the log
  // keeps its own actual items and status.
  db.delete(meals).where(eq(meals.id, id)).run();
  return { ok: true };
}

export function archiveMeal(id: number, archived = true): void {
  db.update(meals).set({ archived }).where(eq(meals.id, id)).run();
}

/* ------------------------------------------------------------------ targets */

export const FALLBACK_TARGET: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function getTarget(dayType: DayType): Macros {
  const row = db.select().from(targets).where(eq(targets.dayType, dayType)).get();
  if (!row) return FALLBACK_TARGET;
  return { kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG };
}

export function getAllTargets(): Record<DayType, Macros> {
  return {
    training: getTarget('training'),
    rest: getTarget('rest'),
    busy: getTarget('busy'),
  };
}

export function setTarget(dayType: DayType, macros: Macros): void {
  db.insert(targets)
    .values({ dayType, ...macros })
    .onConflictDoUpdate({ target: targets.dayType, set: macros })
    .run();
}

export function hasTargets(): boolean {
  return (db.select({ count: sql<number>`count(*)` }).from(targets).get()?.count ?? 0) > 0;
}

/* ----------------------------------------------------------------- day log */

/**
 * The day type actually in force: busy mode overrides the plan, otherwise the
 * template's own type, otherwise whether a workout is scheduled.
 */
export function dayTypeFor(date: IsoDate, isTrainingDay: boolean): {
  dayType: DayType;
  isBusy: boolean;
  templateId: number | null;
} {
  const plan = db.select().from(weekPlan).where(eq(weekPlan.date, date)).get();

  if (plan?.isBusy) {
    return { dayType: 'busy', isBusy: true, templateId: plan.dayTemplateId ?? null };
  }

  if (plan?.dayTemplateId != null) {
    const template = db
      .select()
      .from(dayTemplates)
      .where(eq(dayTemplates.id, plan.dayTemplateId))
      .get();
    if (template) {
      return { dayType: template.dayType, isBusy: false, templateId: template.id };
    }
  }

  return {
    dayType: isTrainingDay ? 'training' : 'rest',
    isBusy: false,
    templateId: plan?.dayTemplateId ?? null,
  };
}

/** Meals the plan calls for on a date, keyed by slot. */
export function plannedSlots(templateId: number | null): Map<MealSlot, number> {
  const map = new Map<MealSlot, number>();
  if (templateId == null) return map;

  const rows = db
    .select()
    .from(dayTemplateSlots)
    .where(eq(dayTemplateSlots.templateId, templateId))
    .all();

  for (const row of rows) {
    map.set(row.slot as MealSlot, row.mealId);
  }
  return map;
}

/**
 * Everything the day screens need.
 *
 * A slot with no log yet is reported as `planned` without writing anything —
 * rows are only created when the day is actually touched, so opening the app
 * never fabricates a log.
 */
export function getDayLog(date: IsoDate, isTrainingDay: boolean): DayLog {
  const { dayType, isBusy, templateId } = dayTypeFor(date, isTrainingDay);
  const planned = plannedSlots(templateId);

  const logs = db.select().from(mealLogs).where(eq(mealLogs.date, date)).all();
  const logBySlot = new Map(logs.map((log) => [log.slot as MealSlot, log]));

  const actualItemsByLog = new Map<number, FoodPortion[]>();
  const changedLogIds = logs.filter((log) => log.status === 'changed').map((log) => log.id);
  if (changedLogIds.length > 0) {
    const rows = db
      .select({ logId: mealLogItems.logId, servings: mealLogItems.servings, food: foods })
      .from(mealLogItems)
      .innerJoin(foods, eq(mealLogItems.foodId, foods.id))
      .where(inArray(mealLogItems.logId, changedLogIds))
      .all();
    for (const row of rows) {
      const list = actualItemsByLog.get(row.logId) ?? [];
      list.push({ food: row.food, servings: row.servings });
      actualItemsByLog.set(row.logId, list);
    }
  }

  const relevantSlots = new Set<MealSlot>([...planned.keys(), ...logBySlot.keys()]);
  const mealIds = [
    ...new Set([
      ...planned.values(),
      ...logs.map((log) => log.mealId).filter((id): id is number => id != null),
    ]),
  ];
  const mealRows = mealIds.length
    ? db.select().from(meals).where(inArray(meals.id, mealIds)).all()
    : [];
  const itemsByMeal = itemsForMeals(mealIds);
  const mealById = new Map(
    mealRows.map((meal) => {
      const items = itemsByMeal.get(meal.id) ?? [];
      return [meal.id, { ...meal, items, macros: portionsToMacros(items) }] as const;
    }),
  );

  const slots: DaySlot[] = [...relevantSlots]
    .sort((a, b) => slotOrder(a) - slotOrder(b))
    .map((slot) => {
      const log = logBySlot.get(slot) ?? null;
      const plannedMealId = log?.mealId ?? planned.get(slot) ?? null;
      const plannedMeal = plannedMealId != null ? (mealById.get(plannedMealId) ?? null) : null;
      const status: MealStatus = log?.status ?? 'planned';

      // Skipped contributes nothing; changed uses its own items; everything
      // else — including the untouched `planned` default — uses the meal.
      let actual: FoodPortion[] = [];
      if (status === 'changed') {
        actual = actualItemsByLog.get(log!.id) ?? [];
      } else if (status !== 'skipped') {
        actual = plannedMeal?.items ?? [];
      }

      return { slot, log, plannedMeal, actual, macros: portionsToMacros(actual), status };
    });

  // Only confirmed or changed meals count as eaten. A planned meal is what the
  // day *will* cost, not what it has cost — the home screen shows both.
  const eaten = slots.filter((s) => s.status === 'confirmed' || s.status === 'changed');

  return {
    date,
    dayType,
    isBusy,
    slots,
    consumed: eaten.reduce((total, s) => ({
      kcal: total.kcal + s.macros.kcal,
      proteinG: total.proteinG + s.macros.proteinG,
      carbsG: total.carbsG + s.macros.carbsG,
      fatG: total.fatG + s.macros.fatG,
    }), ZERO),
    target: getTarget(dayType),
  };
}

/* ------------------------------------------------------------- log writes */

/**
 * Takes the transaction handle rather than reaching for `db`: every caller runs
 * inside a transaction that also rewrites the log's items, and the two writes
 * have to commit or fail together.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function upsertLog(
  tx: Tx,
  date: IsoDate,
  slot: MealSlot,
  values: { mealId?: number | null; status: MealStatus },
): number {
  const existing = tx
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.date, date), eq(mealLogs.slot, slot)))
    .get();

  if (existing) {
    tx.update(mealLogs)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(mealLogs.id, existing.id))
      .run();
    return existing.id;
  }

  return tx
    .insert(mealLogs)
    .values({ date, slot, mealId: values.mealId ?? null, status: values.status })
    .returning({ id: mealLogs.id })
    .get().id;
}

/** The one-tap path: the plan was right, log it as-is. */
export function confirmMeal(date: IsoDate, slot: MealSlot, mealId: number | null): void {
  db.transaction((tx) => {
    const id = upsertLog(tx, date, slot, { mealId, status: 'confirmed' });
    // Leaving stale actual items behind would silently double-count.
    tx.delete(mealLogItems).where(eq(mealLogItems.logId, id)).run();
  });
}

export function skipMeal(date: IsoDate, slot: MealSlot, mealId: number | null): void {
  db.transaction((tx) => {
    const id = upsertLog(tx, date, slot, { mealId, status: 'skipped' });
    tx.delete(mealLogItems).where(eq(mealLogItems.logId, id)).run();
  });
}

/** Reality differed: record what was actually eaten. */
export function changeMeal(
  date: IsoDate,
  slot: MealSlot,
  mealId: number | null,
  items: { foodId: number; servings: number }[],
): void {
  db.transaction((tx) => {
    const id = upsertLog(tx, date, slot, { mealId, status: 'changed' });
    tx.delete(mealLogItems).where(eq(mealLogItems.logId, id)).run();
    for (const item of items) {
      tx.insert(mealLogItems)
        .values({ logId: id, foodId: item.foodId, servings: item.servings })
        .run();
    }
  });
}

/** Undo back to the untouched planned state. */
export function resetMeal(date: IsoDate, slot: MealSlot): void {
  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(mealLogs)
      .where(and(eq(mealLogs.date, date), eq(mealLogs.slot, slot)))
      .get();
    if (!existing) return;
    tx.delete(mealLogItems).where(eq(mealLogItems.logId, existing.id)).run();
    tx.delete(mealLogs).where(eq(mealLogs.id, existing.id)).run();
  });
}

/** Log a meal into a slot that the plan did not call for. */
export function addAdHocMeal(date: IsoDate, slot: MealSlot, mealId: number): void {
  confirmMeal(date, slot, mealId);
}

export function slotsWithoutPlan(dayLog: DayLog): MealSlot[] {
  const used = new Set(dayLog.slots.map((s) => s.slot));
  return MEAL_SLOTS.filter((slot) => !used.has(slot));
}
