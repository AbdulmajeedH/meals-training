import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  dayTemplateSlots,
  dayTemplates,
  foods,
  mealItems,
  meals,
  weekPlan,
  type DayTemplate,
  type DayType,
  type Food,
} from '@/db/schema';
import { addDays, startOfWeek, weekDates, type IsoDate } from '@/lib/date';
import { slotOrder, type MealSlot } from '@/lib/slots';

export type TemplateSlot = { slot: MealSlot; mealId: number; mealName: string };

export type TemplateWithSlots = DayTemplate & { slots: TemplateSlot[] };

export type PlannedDay = {
  date: IsoDate;
  template: DayTemplate | null;
  isBusy: boolean;
};

/* ------------------------------------------------------------- templates */

export function listTemplates(): TemplateWithSlots[] {
  const templates = db.select().from(dayTemplates).orderBy(asc(dayTemplates.id)).all();
  if (templates.length === 0) return [];

  const rows = db
    .select({
      templateId: dayTemplateSlots.templateId,
      slot: dayTemplateSlots.slot,
      mealId: dayTemplateSlots.mealId,
      mealName: meals.nameAr,
    })
    .from(dayTemplateSlots)
    .innerJoin(meals, eq(dayTemplateSlots.mealId, meals.id))
    .where(
      inArray(
        dayTemplateSlots.templateId,
        templates.map((t) => t.id),
      ),
    )
    .all();

  return templates.map((template) => ({
    ...template,
    slots: rows
      .filter((row) => row.templateId === template.id)
      .map((row) => ({ slot: row.slot as MealSlot, mealId: row.mealId, mealName: row.mealName }))
      .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot)),
  }));
}

export function createTemplate(nameAr: string, dayType: DayType): number {
  return db
    .insert(dayTemplates)
    .values({ nameAr, dayType })
    .returning({ id: dayTemplates.id })
    .get().id;
}

export function updateTemplate(id: number, nameAr: string, dayType: DayType): void {
  db.update(dayTemplates).set({ nameAr, dayType }).where(eq(dayTemplates.id, id)).run();
}

export function deleteTemplate(id: number): void {
  db.transaction((tx) => {
    // Days pointing at it fall back to no plan rather than a dangling id.
    tx.update(weekPlan)
      .set({ dayTemplateId: null })
      .where(eq(weekPlan.dayTemplateId, id))
      .run();
    tx.delete(dayTemplates).where(eq(dayTemplates.id, id)).run();
  });
}

export function setTemplateSlot(templateId: number, slot: MealSlot, mealId: number | null): void {
  if (mealId == null) {
    db.delete(dayTemplateSlots)
      .where(and(eq(dayTemplateSlots.templateId, templateId), eq(dayTemplateSlots.slot, slot)))
      .run();
    return;
  }

  db.insert(dayTemplateSlots)
    .values({ templateId, slot, mealId, sort: slotOrder(slot) })
    .onConflictDoUpdate({
      target: [dayTemplateSlots.templateId, dayTemplateSlots.slot],
      set: { mealId },
    })
    .run();
}

/* ------------------------------------------------------------- week plan */

/**
 * Writes take an explicit handle so the batch helpers below can run many of them
 * inside one transaction. Reaching for `db` from inside a `db.transaction`
 * callback would escape that transaction entirely.
 */
type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function ensurePlanRow(writer: Writer, date: IsoDate): void {
  writer
    .insert(weekPlan)
    .values({ date, dayTemplateId: null, isBusy: false })
    .onConflictDoNothing()
    .run();
}

export function setDayTemplate(
  date: IsoDate,
  templateId: number | null,
  writer: Writer = db,
): void {
  ensurePlanRow(writer, date);
  writer.update(weekPlan).set({ dayTemplateId: templateId }).where(eq(weekPlan.date, date)).run();
}

export function setBusy(date: IsoDate, isBusy: boolean, writer: Writer = db): void {
  ensurePlanRow(writer, date);
  writer.update(weekPlan).set({ isBusy }).where(eq(weekPlan.date, date)).run();
}

export function getWeek(anyDateInWeek: IsoDate): PlannedDay[] {
  const start = startOfWeek(anyDateInWeek);
  const dates = weekDates(start);

  const rows = db.select().from(weekPlan).where(inArray(weekPlan.date, dates)).all();
  const byDate = new Map(rows.map((row) => [row.date, row]));

  const templates = db.select().from(dayTemplates).all();
  const templateById = new Map(templates.map((t) => [t.id, t]));

  return dates.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      template: row?.dayTemplateId != null ? (templateById.get(row.dayTemplateId) ?? null) : null,
      isBusy: row?.isBusy ?? false,
    };
  });
}

/**
 * Apply a template across a week, rotating through the given templates.
 * Rotating two or three templates is the whole scheduling model — seven unique
 * days is exactly the tedium that kills adherence.
 */
export function rotateTemplates(weekStart: IsoDate, templateIds: number[]): void {
  if (templateIds.length === 0) return;
  db.transaction((tx) => {
    weekDates(weekStart).forEach((date, index) => {
      setDayTemplate(date, templateIds[index % templateIds.length], tx);
    });
  });
}

/** Copy a whole week's assignments forward. */
export function copyWeek(fromWeekStart: IsoDate, toWeekStart: IsoDate): void {
  const source = getWeek(fromWeekStart);
  db.transaction((tx) => {
    source.forEach((day, index) => {
      setDayTemplate(addDays(toWeekStart, index), day.template?.id ?? null, tx);
    });
  });
}

/* --------------------------------------------------------- shopping list */

export type ShoppingLine = { food: Food; servings: number };

/**
 * Everything the week's plan calls for, with the same food aggregated across
 * every meal it appears in. Busy days use their template like any other day.
 */
export function shoppingList(weekStart: IsoDate): ShoppingLine[] {
  const week = getWeek(weekStart);
  const templateIds = week
    .map((day) => day.template?.id)
    .filter((id): id is number => id != null);

  if (templateIds.length === 0) return [];

  // How many times each template appears in the week.
  const templateCount = new Map<number, number>();
  for (const id of templateIds) {
    templateCount.set(id, (templateCount.get(id) ?? 0) + 1);
  }

  const rows = db
    .select({
      templateId: dayTemplateSlots.templateId,
      servings: mealItems.servings,
      food: foods,
    })
    .from(dayTemplateSlots)
    .innerJoin(mealItems, eq(dayTemplateSlots.mealId, mealItems.mealId))
    .innerJoin(foods, eq(mealItems.foodId, foods.id))
    .where(inArray(dayTemplateSlots.templateId, [...templateCount.keys()]))
    .all();

  const byFood = new Map<number, ShoppingLine>();
  for (const row of rows) {
    const days = templateCount.get(row.templateId) ?? 0;
    const line = byFood.get(row.food.id) ?? { food: row.food, servings: 0 };
    line.servings += row.servings * days;
    byFood.set(row.food.id, line);
  }

  return [...byFood.values()].sort((a, b) => a.food.nameAr.localeCompare(b.food.nameAr, 'ar'));
}

/**
 * Meals worth batch-cooking: those the week's plan calls for more than once,
 * with how many portions to make.
 */
export function mealPrepList(weekStart: IsoDate): { mealId: number; name: string; portions: number }[] {
  const week = getWeek(weekStart);
  const templateIds = week.map((day) => day.template?.id).filter((id): id is number => id != null);
  if (templateIds.length === 0) return [];

  const templateCount = new Map<number, number>();
  for (const id of templateIds) templateCount.set(id, (templateCount.get(id) ?? 0) + 1);

  const rows = db
    .select({
      templateId: dayTemplateSlots.templateId,
      mealId: dayTemplateSlots.mealId,
      name: meals.nameAr,
    })
    .from(dayTemplateSlots)
    .innerJoin(meals, eq(dayTemplateSlots.mealId, meals.id))
    .where(inArray(dayTemplateSlots.templateId, [...templateCount.keys()]))
    .all();

  const byMeal = new Map<number, { mealId: number; name: string; portions: number }>();
  for (const row of rows) {
    const days = templateCount.get(row.templateId) ?? 0;
    const entry = byMeal.get(row.mealId) ?? { mealId: row.mealId, name: row.name, portions: 0 };
    entry.portions += days;
    byMeal.set(row.mealId, entry);
  }

  return [...byMeal.values()]
    .filter((entry) => entry.portions > 1)
    .sort((a, b) => b.portions - a.portions);
}

export function hasTemplates(): boolean {
  return (db.select({ count: sql<number>`count(*)` }).from(dayTemplates).get()?.count ?? 0) > 0;
}
