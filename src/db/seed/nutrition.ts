/**
 * Writes the nutrition plan (src/db/seed/plan-data.ts) into the database.
 *
 * Kept separate from the data so the plan itself can be checked against its
 * own stated targets under plain Node, without pulling in expo-sqlite.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  bodyWeight,
  dayTemplateSlots,
  dayTemplates,
  foods,
  mealItems,
  meals,
  settings,
  targets,
  weekPlan,
} from '@/db/schema';
import { startOfWeek, today, weekDates, weekday, type IsoDate } from '@/lib/date';

import {
  FOODS,
  INBODY_DATE,
  INBODY_WEIGHT_KG,
  MEALS,
  TARGET,
  TEMPLATES,
  WEEKDAY_TEMPLATE,
} from './plan-data';

const SEED_KEY = 'nutrition_seed_version';
const SEED_VERSION = '1';

export function isNutritionSeeded(): boolean {
  const row = db.select().from(settings).where(eq(settings.key, SEED_KEY)).get();
  return row?.value === SEED_VERSION;
}

/**
 * Write the plan into an empty database.
 *
 * Idempotent via a settings flag, and refuses to run when foods already exist,
 * so it can never overwrite food that has been edited or added by hand.
 */
export function seedNutrition(): { seeded: boolean; reason?: 'already' | 'not_empty' } {
  if (isNutritionSeeded()) return { seeded: false, reason: 'already' };

  const existingFoods = db.select({ id: foods.id }).from(foods).limit(1).all();
  if (existingFoods.length > 0) return { seeded: false, reason: 'not_empty' };

  db.transaction((tx) => {
    const foodIds = new Map<string, number>();
    for (const food of FOODS) {
      const { key, ...values } = food;
      const id = tx.insert(foods).values(values).returning({ id: foods.id }).get().id;
      foodIds.set(key, id);
    }

    const mealIds = new Map<string, number>();
    for (const meal of MEALS) {
      const id = tx
        .insert(meals)
        .values({ nameAr: meal.nameAr })
        .returning({ id: meals.id })
        .get().id;
      mealIds.set(meal.key, id);
      meal.items.forEach(([foodKey, servings], index) => {
        const foodId = foodIds.get(foodKey);
        if (foodId == null) throw new Error(`seed: unknown food "${foodKey}" in meal "${meal.key}"`);
        tx.insert(mealItems).values({ mealId: id, foodId, servings, sort: index }).run();
      });
    }

    const templateIds = new Map<string, number>();
    for (const template of TEMPLATES) {
      const id = tx
        .insert(dayTemplates)
        .values({ nameAr: template.nameAr, dayType: template.dayType })
        .returning({ id: dayTemplates.id })
        .get().id;
      templateIds.set(template.key, id);
      template.slots.forEach(([slot, mealKey], index) => {
        const mealId = mealIds.get(mealKey);
        if (mealId == null) {
          throw new Error(`seed: unknown meal "${mealKey}" in template "${template.key}"`);
        }
        tx.insert(dayTemplateSlots).values({ templateId: id, slot, mealId, sort: index }).run();
      });
    }

    for (const dayType of ['training', 'rest', 'busy'] as const) {
      tx.insert(targets).values({ dayType, ...TARGET }).run();
    }

    // Lay the plan over the current week so the app opens on a live day.
    for (const date of weekDates(startOfWeek(today()))) {
      const templateId = templateIds.get(WEEKDAY_TEMPLATE[weekday(date)]);
      if (templateId == null) continue;
      tx.insert(weekPlan)
        .values({ date, dayTemplateId: templateId, isBusy: false })
        .onConflictDoUpdate({ target: weekPlan.date, set: { dayTemplateId: templateId } })
        .run();
    }

    tx.insert(bodyWeight)
      .values({ date: INBODY_DATE, kg: INBODY_WEIGHT_KG })
      .onConflictDoNothing()
      .run();

    tx.insert(settings)
      .values({ key: SEED_KEY, value: SEED_VERSION })
      .onConflictDoUpdate({ target: settings.key, set: { value: SEED_VERSION } })
      .run();
  });

  return { seeded: true };
}

/**
 * Re-apply the weekday-to-template mapping over a week.
 *
 * Matches templates by name rather than by seed key, so a renamed template
 * simply stops being auto-assigned instead of silently overwriting a
 * hand-made plan.
 */
export function applyPlanToWeek(weekStart: IsoDate): void {
  const existing = db.select().from(dayTemplates).all();
  const idByName = new Map(existing.map((t) => [t.nameAr, t.id]));
  const nameByKey = new Map(TEMPLATES.map((t) => [t.key, t.nameAr]));

  db.transaction((tx) => {
    for (const date of weekDates(weekStart)) {
      const name = nameByKey.get(WEEKDAY_TEMPLATE[weekday(date)]);
      const templateId = name != null ? idByName.get(name) : undefined;
      if (templateId == null) continue;
      tx.insert(weekPlan)
        .values({ date, dayTemplateId: templateId, isBusy: false })
        .onConflictDoUpdate({ target: weekPlan.date, set: { dayTemplateId: templateId } })
        .run();
    }
  });
}
