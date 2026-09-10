import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * The whole data model, in one file.
 *
 * Conventions:
 * - Calendar days are TEXT `YYYY-MM-DD`, always local (see src/lib/date.ts).
 * - Instants are INTEGER epoch milliseconds.
 * - Macros are REAL. Servings are fractional, so grams are fractional too.
 * - The array-shaped fields in the spec (`items[]`, `slots[]`) are join tables,
 *   because the shopping list has to aggregate the same food across meals.
 *   The one exception is `weekly_reviews.missed_reasons`, which is a small JSON
 *   list that is never joined against.
 */

export type DayType = 'training' | 'rest' | 'busy';
export type MealStatus = 'planned' | 'confirmed' | 'changed' | 'skipped';
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';
export type MissedReason = 'travel' | 'work' | 'no_food' | 'tired' | 'other';

/**
 * Most sets are counted in reps; holds like a plank are counted in seconds.
 * Without this the two are indistinguishable in `set_logs.reps`, and a 60-second
 * plank renders as "60 reps".
 */
export type RepUnit = 'reps' | 'seconds';

const now = () => Date.now();

/* ------------------------------------------------------------------ targets */

export const targets = sqliteTable('targets', {
  dayType: text('day_type').$type<DayType>().primaryKey(),
  kcal: real('kcal').notNull(),
  proteinG: real('protein_g').notNull(),
  carbsG: real('carbs_g').notNull(),
  fatG: real('fat_g').notNull(),
});

/* -------------------------------------------------------------------- foods */

export const foods = sqliteTable(
  'foods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nameAr: text('name_ar').notNull(),
    servingLabel: text('serving_label').notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    /** Hidden from pickers but kept so old logs still resolve. */
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('foods_name_idx').on(t.nameAr)],
);

/* ------------------------------------------------------------ meal library */

export const meals = sqliteTable('meals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameAr: text('name_ar').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(now),
});

export const mealItems = sqliteTable(
  'meal_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mealId: integer('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    servings: real('servings').notNull().default(1),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('meal_items_meal_idx').on(t.mealId)],
);

/* ----------------------------------------------------------- day templates */

export const dayTemplates = sqliteTable('day_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameAr: text('name_ar').notNull(),
  dayType: text('day_type').$type<DayType>().notNull(),
});

export const dayTemplateSlots = sqliteTable(
  'day_template_slots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    templateId: integer('template_id')
      .notNull()
      .references(() => dayTemplates.id, { onDelete: 'cascade' }),
    /** Slot key from src/lib/slots.ts — stable, not a display label. */
    slot: text('slot').notNull(),
    mealId: integer('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'restrict' }),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [uniqueIndex('day_template_slots_unique').on(t.templateId, t.slot)],
);

/* --------------------------------------------------------------- week plan */

export const weekPlan = sqliteTable('week_plan', {
  date: text('date').primaryKey(),
  dayTemplateId: integer('day_template_id').references(() => dayTemplates.id, {
    onDelete: 'set null',
  }),
  /** Busy mode swaps in the busy targets and template; the day still scores. */
  isBusy: integer('is_busy', { mode: 'boolean' }).notNull().default(false),
});

/* --------------------------------------------------------------- meal logs */

export const mealLogs = sqliteTable(
  'meal_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    slot: text('slot').notNull(),
    /** The meal that was planned. Kept even when status is `changed`. */
    mealId: integer('meal_id').references(() => meals.id, { onDelete: 'set null' }),
    status: text('status').$type<MealStatus>().notNull().default('planned'),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex('meal_logs_date_slot').on(t.date, t.slot), index('meal_logs_date').on(t.date)],
);

/** Only populated when a log's status is `changed` — this is `actual_items`. */
export const mealLogItems = sqliteTable(
  'meal_log_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    logId: integer('log_id')
      .notNull()
      .references(() => mealLogs.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    servings: real('servings').notNull().default(1),
  },
  (t) => [index('meal_log_items_log_idx').on(t.logId)],
);

/* ----------------------------------------------------------------- program */

export const programDays = sqliteTable('program_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
  /**
   * Retired days are hidden from the schedule but still resolve for past
   * sessions. Sessions reference this table with ON DELETE RESTRICT, so once a
   * day has been trained it is archived rather than deleted — losing training
   * history to an edit would be far worse than a stale row.
   */
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const exercises = sqliteTable(
  'exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    programDayId: integer('program_day_id')
      .notNull()
      .references(() => programDays.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sets: integer('sets').notNull(),
    repMin: integer('rep_min').notNull(),
    repMax: integer('rep_max').notNull(),
    restSec: integer('rest_sec').notNull().default(120),
    /** What rep_min/rep_max and set_logs.reps are measured in. */
    repUnit: text('rep_unit').$type<RepUnit>().notNull().default('reps'),
    notes: text('notes'),
    sort: integer('sort').notNull().default(0),
    /** Same reasoning as program_days: archived once it has logged sets. */
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('exercises_day_idx').on(t.programDayId)],
);

/** One row per weekday. A null `program_day_id` means a rest day. */
export const programSchedule = sqliteTable('program_schedule', {
  weekday: integer('weekday').primaryKey(),
  programDayId: integer('program_day_id').references(() => programDays.id, {
    onDelete: 'set null',
  }),
});

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    programDayId: integer('program_day_id')
      .notNull()
      .references(() => programDays.id, { onDelete: 'restrict' }),
    status: text('status').$type<SessionStatus>().notNull().default('planned'),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
  },
  (t) => [uniqueIndex('workout_sessions_date').on(t.date)],
);

export const setLogs = sqliteTable(
  'set_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    setNo: integer('set_no').notNull(),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('set_logs_unique').on(t.sessionId, t.exerciseId, t.setNo),
    index('set_logs_exercise_idx').on(t.exerciseId),
  ],
);

/* ------------------------------------------------------- weight & reviews */

export const bodyWeight = sqliteTable('body_weight', {
  date: text('date').primaryKey(),
  kg: real('kg').notNull(),
});

export const weeklyReviews = sqliteTable('weekly_reviews', {
  weekStart: text('week_start').primaryKey(),
  /** JSON array of MissedReason. Small and never joined against. */
  missedReasons: text('missed_reasons').notNull().default(sql`'[]'`),
  note: text('note'),
  createdAt: integer('created_at').notNull().$defaultFn(now),
});

/* --------------------------------------------------------------- settings */

/** Single-row-per-key store for reminder times, last backup, etc. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/* ---------------------------------------------------------- personal bests */

/** Denormalised so the progress screen never scans every set ever logged. */
export const personalBests = sqliteTable(
  'personal_bests',
  {
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    /** Best estimated 1RM seen, and the set that produced it. */
    weightKg: real('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    estimatedOneRm: real('estimated_one_rm').notNull(),
    date: text('date').notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId] })],
);

/* -------------------------------------------------------------- relations */

export const mealsRelations = relations(meals, ({ many }) => ({
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
  food: one(foods, { fields: [mealItems.foodId], references: [foods.id] }),
}));

export const dayTemplatesRelations = relations(dayTemplates, ({ many }) => ({
  slots: many(dayTemplateSlots),
}));

export const dayTemplateSlotsRelations = relations(dayTemplateSlots, ({ one }) => ({
  template: one(dayTemplates, {
    fields: [dayTemplateSlots.templateId],
    references: [dayTemplates.id],
  }),
  meal: one(meals, { fields: [dayTemplateSlots.mealId], references: [meals.id] }),
}));

export const mealLogsRelations = relations(mealLogs, ({ one, many }) => ({
  meal: one(meals, { fields: [mealLogs.mealId], references: [meals.id] }),
  actualItems: many(mealLogItems),
}));

export const mealLogItemsRelations = relations(mealLogItems, ({ one }) => ({
  log: one(mealLogs, { fields: [mealLogItems.logId], references: [mealLogs.id] }),
  food: one(foods, { fields: [mealLogItems.foodId], references: [foods.id] }),
}));

export const programDaysRelations = relations(programDays, ({ many }) => ({
  exercises: many(exercises),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  programDay: one(programDays, {
    fields: [exercises.programDayId],
    references: [programDays.id],
  }),
  setLogs: many(setLogs),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  programDay: one(programDays, {
    fields: [workoutSessions.programDayId],
    references: [programDays.id],
  }),
  sets: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  session: one(workoutSessions, {
    fields: [setLogs.sessionId],
    references: [workoutSessions.id],
  }),
  exercise: one(exercises, { fields: [setLogs.exerciseId], references: [exercises.id] }),
}));

/* ------------------------------------------------------------------ types */

export type Target = typeof targets.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type MealItem = typeof mealItems.$inferSelect;
export type DayTemplate = typeof dayTemplates.$inferSelect;
export type DayTemplateSlot = typeof dayTemplateSlots.$inferSelect;
export type WeekPlanDay = typeof weekPlan.$inferSelect;
export type MealLog = typeof mealLogs.$inferSelect;
export type MealLogItem = typeof mealLogItems.$inferSelect;
export type ProgramDay = typeof programDays.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type BodyWeight = typeof bodyWeight.$inferSelect;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;
export type PersonalBest = typeof personalBests.$inferSelect;
