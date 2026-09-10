/**
 * The real nutrition plan, as plain data.
 *
 * Source: the user's weight-gain plan (InBody 2026-07-11: 174 cm, 50.7 kg,
 * 25.6 kg skeletal muscle, 9.2% body fat, BMI 16.7). Six named days plus two
 * daily snacks, aimed at 2400-2600 kcal and 100-110 g protein, assuming
 * resistance training 3-5 days a week.
 *
 * Two things to know about the numbers below:
 *
 * 1. The QUANTITIES and the MEAL COMPOSITION are exactly as written in the
 *    plan - nothing added, nothing swapped.
 * 2. The plan states totals, not per-food macros, so the per-serving macros
 *    here are standard food-composition reference values. They are estimates.
 *    The plan itself says as much: actual values vary with ingredients,
 *    quantities, oils and restaurant portions. Edit any food in the app when
 *    a real label disagrees.
 *
 * Measurement conventions from the plan: chicken and meat weighed cooked and
 * boneless, rice weighed cooked (a cup is 150-160 g), a medium Arabic loaf
 * is 60 g, a teaspoon is 5 ml and a tablespoon 15 ml.
 *
 * No database imports here on purpose - src/db/seed/plan-data.test.ts checks
 * the composed days against the plan's stated targets, and that test has to
 * run under plain Node.
 */

import type { MealSlot } from '@/lib/slots';
import type { IsoDate } from '@/lib/date';

/* --------------------------------------------------------------------foods */

export type FoodSeed = {
  key: string;
  nameAr: string;
  servingLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Serving sizes are chosen so the plan's quantities land on whole or half servings. */
export const FOODS: FoodSeed[] = [
  { key: 'egg', nameAr: 'بيض', servingLabel: 'بيضة (50 جم)', kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 },
  { key: 'olive_oil', nameAr: 'زيت زيتون', servingLabel: 'ملعقة شاي (5 مل)', kcal: 40, proteinG: 0, carbsG: 0, fatG: 4.5 },
  { key: 'pita', nameAr: 'رغيف عربي', servingLabel: 'رغيف متوسط (60 جم)', kcal: 165, proteinG: 5.5, carbsG: 33, fatG: 1 },
  { key: 'white_cheese', nameAr: 'جبن أبيض', servingLabel: '30 جم', kcal: 80, proteinG: 5.4, carbsG: 1.2, fatG: 6 },
  { key: 'labneh', nameAr: 'لبنة', servingLabel: '30 جم', kcal: 55, proteinG: 2.4, carbsG: 1.5, fatG: 4.5 },
  { key: 'orange', nameAr: 'برتقال', servingLabel: 'حبة متوسطة', kcal: 62, proteinG: 1.2, carbsG: 15.4, fatG: 0.2 },
  { key: 'apple', nameAr: 'تفاح', servingLabel: 'حبة متوسطة', kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 },
  { key: 'banana', nameAr: 'موز', servingLabel: 'حبة متوسطة', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
  { key: 'milk', nameAr: 'حليب كامل الدسم', servingLabel: '250 مل', kcal: 155, proteinG: 8, carbsG: 12, fatG: 8.3 },
  { key: 'dates', nameAr: 'تمر', servingLabel: 'حبة صغيرة', kcal: 20, proteinG: 0.2, carbsG: 5.3, fatG: 0.1 },
  { key: 'nuts', nameAr: 'مكسرات غير مملحة', servingLabel: '30 جم', kcal: 180, proteinG: 5.5, carbsG: 6.5, fatG: 15.5 },
  { key: 'foul', nameAr: 'فول مدمس', servingLabel: '¾ كوب (190 جم)', kcal: 175, proteinG: 11.5, carbsG: 28, fatG: 1.5 },
  { key: 'rice', nameAr: 'رز أبيض مطبوخ', servingLabel: 'كوب (155 جم)', kcal: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4 },
  { key: 'chicken', nameAr: 'دجاج مطبوخ بدون عظم', servingLabel: '100 جم', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  { key: 'mince', nameAr: 'لحم مفروم مطبوخ', servingLabel: '100 جم', kcal: 250, proteinG: 26, carbsG: 0, fatG: 16 },
  { key: 'beef', nameAr: 'لحم بقري مطبوخ بدون عظم', servingLabel: '100 جم', kcal: 215, proteinG: 28, carbsG: 0, fatG: 11 },
  { key: 'yogurt', nameAr: 'زبادي كامل الدسم', servingLabel: 'علبة 170 جم', kcal: 105, proteinG: 6, carbsG: 8, fatG: 5.5 },
  { key: 'salad', nameAr: 'سلطة خضار', servingLabel: 'طبق', kcal: 45, proteinG: 1.5, carbsG: 8, fatG: 0.5 },
  { key: 'veg', nameAr: 'خضار جانبية', servingLabel: 'حصة', kcal: 50, proteinG: 2, carbsG: 9, fatG: 0.5 },
  { key: 'pasta', nameAr: 'مكرونة مطبوخة', servingLabel: 'كوب (140 جم)', kcal: 200, proteinG: 7.5, carbsG: 40, fatG: 1.2 },
  { key: 'tomato_sauce', nameAr: 'صلصة طماطم', servingLabel: 'نصف كوب', kcal: 40, proteinG: 1.5, carbsG: 8, fatG: 0.5 },
  { key: 'tahini', nameAr: 'طحينة', servingLabel: 'ملعقة كبيرة', kcal: 89, proteinG: 2.6, carbsG: 3.2, fatG: 8 },
  { key: 'garlic_sauce', nameAr: 'صوص ثوم', servingLabel: 'ملعقة كبيرة', kcal: 90, proteinG: 0.2, carbsG: 1, fatG: 9.5 },
  { key: 'baked_potato', nameAr: 'بطاطس بالفرن', servingLabel: '100 جم', kcal: 150, proteinG: 2.5, carbsG: 24, fatG: 5 },
  { key: 'fries_small', nameAr: 'بطاطس مقلية صغيرة', servingLabel: 'حصة مطعم صغيرة', kcal: 230, proteinG: 3, carbsG: 29, fatG: 11 },
  { key: 'burger_bun', nameAr: 'خبز برجر', servingLabel: 'قطعة', kcal: 150, proteinG: 5, carbsG: 27, fatG: 2.5 },
  { key: 'cheese_slice', nameAr: 'شريحة جبن', servingLabel: 'شريحة', kcal: 70, proteinG: 4, carbsG: 1, fatG: 5.8 },
  { key: 'crispy_coat', nameAr: 'تغليفة مقرمشة', servingLabel: 'حصة (نحو 30 جم)', kcal: 110, proteinG: 3, carbsG: 20, fatG: 2 },
  { key: 'zinger', nameAr: 'ساندويتش زنجر متوسط', servingLabel: 'ساندويتش', kcal: 450, proteinG: 24, carbsG: 45, fatG: 19 },
  { key: 'shawarma', nameAr: 'ساندويتش شاورما دجاج صغير', servingLabel: 'ساندويتش', kcal: 300, proteinG: 18, carbsG: 30, fatG: 12 },
  { key: 'saj_bread', nameAr: 'خبز صاج', servingLabel: 'رغيف', kcal: 180, proteinG: 6, carbsG: 35, fatG: 1.5 },
  { key: 'beef_patty', nameAr: 'قطعة برجر لحم', servingLabel: '120 جم', kcal: 300, proteinG: 26, carbsG: 0, fatG: 21 },
];

/* --------------------------------------------------------------------meals */

export type MealSeed = { key: string; nameAr: string; items: [foodKey: string, servings: number][] };

export const MEALS: MealSeed[] = [
  /* ------------------------------------------------------------- snacks */
  {
    key: 'snack_milk_banana',
    nameAr: 'سناك: حليب وموز',
    items: [['milk', 1], ['banana', 1]],
  },
  {
    key: 'snack_dates_nuts',
    nameAr: 'سناك: تمر ومكسرات',
    items: [['dates', 3], ['nuts', 1]],
  },

  /* ---------------------------------------------------------- Saturday */
  {
    key: 'sat_breakfast',
    nameAr: 'فطور: شكشوكة وجبن',
    items: [['egg', 2], ['olive_oil', 1], ['pita', 1], ['white_cheese', 1], ['orange', 1]],
  },
  {
    key: 'sat_lunch',
    nameAr: 'غداء: كبسة دجاج',
    items: [['rice', 2], ['chicken', 1.2], ['yogurt', 1], ['salad', 1]],
  },
  {
    // Thursday's dinner is the same meal; the library holds it once.
    key: 'zinger_dinner',
    nameAr: 'عشاء: زنجر وبطاطس',
    items: [['zinger', 1], ['fries_small', 1], ['veg', 1]],
  },

  /* ------------------------------------------------------------ Sunday */
  {
    key: 'sun_breakfast',
    nameAr: 'فطور: فول وبيض',
    items: [['foul', 1], ['olive_oil', 3], ['egg', 1], ['pita', 1]],
  },
  {
    key: 'sun_lunch',
    nameAr: 'غداء: مكرونة بلحم مفروم',
    items: [['pasta', 2], ['tomato_sauce', 1], ['mince', 1.2], ['olive_oil', 1], ['salad', 1]],
  },
  {
    key: 'sun_dinner',
    nameAr: 'عشاء: شاورما دجاج',
    items: [['shawarma', 2], ['garlic_sauce', 1]],
  },

  /* ------------------------------------------------------------ Monday */
  {
    key: 'mon_breakfast',
    nameAr: 'فطور: ساندويتش بيض وجبن',
    items: [['pita', 1], ['egg', 2], ['white_cheese', 1], ['apple', 1]],
  },
  {
    key: 'mon_lunch',
    nameAr: 'غداء: دجاج بالفرن ورز',
    items: [['chicken', 1.2], ['rice', 2], ['yogurt', 1], ['salad', 1]],
  },
  {
    key: 'mon_dinner',
    nameAr: 'عشاء: زنجر منزلي',
    items: [
      ['chicken', 1],
      ['crispy_coat', 1],
      ['burger_bun', 1],
      ['cheese_slice', 1],
      ['garlic_sauce', 1],
      ['baked_potato', 2],
    ],
  },

  /* ----------------------------------------------------------- Tuesday */
  {
    key: 'tue_breakfast',
    nameAr: 'فطور: لبنة وبيض',
    items: [['pita', 1], ['labneh', 2], ['egg', 2], ['olive_oil', 1], ['orange', 1]],
  },
  {
    key: 'tue_lunch',
    nameAr: 'غداء: شيش طاووق',
    items: [['chicken', 1.2], ['rice', 2], ['salad', 1], ['tahini', 1]],
  },
  {
    key: 'tue_dinner',
    nameAr: 'عشاء: صاج دجاج',
    items: [['saj_bread', 1], ['chicken', 1], ['white_cheese', 1], ['garlic_sauce', 1], ['baked_potato', 1.5]],
  },

  /* --------------------------------------------------------- Wednesday */
  {
    key: 'wed_breakfast',
    nameAr: 'فطور: فول وجبن',
    items: [['foul', 1], ['white_cheese', 1], ['pita', 1], ['olive_oil', 3]],
  },
  {
    key: 'wed_lunch',
    nameAr: 'غداء: مندي دجاج',
    items: [['rice', 2], ['chicken', 1.2], ['yogurt', 1], ['salad', 1]],
  },
  {
    key: 'wed_dinner',
    nameAr: 'عشاء: برجر لحم',
    items: [['beef_patty', 1], ['burger_bun', 1], ['cheese_slice', 1], ['veg', 1], ['fries_small', 1]],
  },

  /* ---------------------------------------------------------- Thursday */
  {
    key: 'thu_breakfast',
    nameAr: 'فطور: شكشوكة وتفاح',
    items: [['egg', 2], ['pita', 1], ['white_cheese', 1], ['olive_oil', 1], ['apple', 1]],
  },
  {
    key: 'thu_lunch',
    nameAr: 'غداء: مرق لحم وخضار',
    items: [['beef', 1.2], ['rice', 2], ['yogurt', 1], ['veg', 1]],
  },
];

/* ---------------------------------------------------------------templates */

export type TemplateSeed = {
  key: string;
  nameAr: string;
  /** Every day of this plan is an eating day — see TARGETS below. */
  dayType: 'training' | 'rest' | 'busy';
  slots: [slot: MealSlot, mealKey: string][];
};

export const SNACKS: [MealSlot, string][] = [
  ['snack_am', 'snack_milk_banana'],
  ['snack_pm', 'snack_dates_nuts'],
];

export const TEMPLATES: TemplateSeed[] = [
  {
    key: 'sat',
    nameAr: 'يوم السبت',
    dayType: 'training',
    slots: [['breakfast', 'sat_breakfast'], ['lunch', 'sat_lunch'], ['dinner', 'zinger_dinner'], ...SNACKS],
  },
  {
    key: 'sun',
    nameAr: 'يوم الأحد',
    dayType: 'training',
    slots: [['breakfast', 'sun_breakfast'], ['lunch', 'sun_lunch'], ['dinner', 'sun_dinner'], ...SNACKS],
  },
  {
    key: 'mon',
    nameAr: 'يوم الاثنين',
    dayType: 'training',
    slots: [['breakfast', 'mon_breakfast'], ['lunch', 'mon_lunch'], ['dinner', 'mon_dinner'], ...SNACKS],
  },
  {
    key: 'tue',
    nameAr: 'يوم الثلاثاء',
    dayType: 'training',
    slots: [['breakfast', 'tue_breakfast'], ['lunch', 'tue_lunch'], ['dinner', 'tue_dinner'], ...SNACKS],
  },
  {
    key: 'wed',
    nameAr: 'يوم الأربعاء',
    dayType: 'training',
    slots: [['breakfast', 'wed_breakfast'], ['lunch', 'wed_lunch'], ['dinner', 'wed_dinner'], ...SNACKS],
  },
  {
    key: 'thu',
    nameAr: 'يوم الخميس',
    dayType: 'training',
    slots: [['breakfast', 'thu_breakfast'], ['lunch', 'thu_lunch'], ['dinner', 'zinger_dinner'], ...SNACKS],
  },
  {
    /**
     * Not in the written plan as a seventh day. Built only from meals the plan
     * already contains, using its own rule that a restaurant meal may stand in
     * for the scheduled one — so a day with no time to cook still hits the
     * target instead of being abandoned.
     */
    key: 'busy',
    nameAr: 'يوم مشغول',
    dayType: 'busy',
    slots: [
      ['breakfast', 'mon_breakfast'],
      ['lunch', 'sun_dinner'],
      ['dinner', 'zinger_dinner'],
      ...SNACKS,
    ],
  },
];




/**
 * Weekday (0 = Sunday) to template. The plan runs Saturday-Thursday and says
 * the seventh day repeats any day of choice, so Friday starts on Saturday's
 * template and can be changed from the week screen.
 */
export const WEEKDAY_TEMPLATE: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'sat',
  6: 'sat',
};

/**
 * The plan states 2400-2600 kcal and 100-110 g protein; these are the midpoints.
 *
 * Carbs and fat are not stated, so they are derived to fill the calorie budget
 * at 4/4/9 with a fat share that matches the plan's own food (rice-heavy Arabic
 * meals with oil, tahini and sauces): 105*4 + 340*4 + 80*9 = 2500.
 *
 * All three day types carry the same numbers on purpose. The plan is explicit
 * that intake and protein stay up on rest days, and busy mode swaps the
 * template - the easier food - not the target.
 */
export const TARGET = { kcal: 2500, proteinG: 105, carbsG: 340, fatG: 80 };

/** The plan's stated ranges, kept so tests can assert against them directly. */
export const PLAN_KCAL_RANGE = [2400, 2600] as const;
export const PLAN_PROTEIN_RANGE = [100, 110] as const;

/** From the InBody measurement the plan was written against. */
export const INBODY_DATE: IsoDate = '2026-07-11';
export const INBODY_WEIGHT_KG = 50.7;

/** Total macros of one template's day, from the seed data alone. */
export function templateTotals(templateKey: string) {
  const template = TEMPLATES.find((t) => t.key === templateKey);
  if (!template) throw new Error(`unknown template "${templateKey}"`);

  const foodByKey = new Map(FOODS.map((f) => [f.key, f]));
  const mealByKey = new Map(MEALS.map((m) => [m.key, m]));

  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  for (const [, mealKey] of template.slots) {
    const meal = mealByKey.get(mealKey);
    if (!meal) throw new Error(`unknown meal "${mealKey}"`);
    for (const [foodKey, servings] of meal.items) {
      const food = foodByKey.get(foodKey);
      if (!food) throw new Error(`unknown food "${foodKey}"`);
      kcal += food.kcal * servings;
      proteinG += food.proteinG * servings;
      carbsG += food.carbsG * servings;
      fatG += food.fatG * servings;
    }
  }

  return { kcal, proteinG, carbsG, fatG };
}
