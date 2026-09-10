/**
 * Meal slots are stable keys, never display strings — they are the unique part
 * of `meal_logs (date, slot)` and of `day_template_slots (template_id, slot)`.
 * Renaming a label must never orphan a log.
 */
export const MEAL_SLOTS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export const SLOT_LABEL_AR: Record<MealSlot, string> = {
  breakfast: 'الفطور',
  snack_am: 'سناك الصباح',
  lunch: 'الغداء',
  snack_pm: 'سناك العصر',
  dinner: 'العشاء',
};

/** Default clock position of each slot, used to order cards and seed reminders. */
export const SLOT_DEFAULT_HOUR: Record<MealSlot, number> = {
  breakfast: 8,
  snack_am: 11,
  lunch: 14,
  snack_pm: 17,
  dinner: 20,
};

export function slotOrder(slot: string): number {
  const index = MEAL_SLOTS.indexOf(slot as MealSlot);
  return index === -1 ? MEAL_SLOTS.length : index;
}

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

export const DAY_TYPE_LABEL_AR = {
  training: 'يوم تمرين',
  rest: 'يوم راحة',
  busy: 'يوم مشغول',
} as const;
