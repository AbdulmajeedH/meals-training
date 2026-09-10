/**
 * Prints the macro totals of every seeded day, so the plan can be sanity-checked
 * against its stated targets by eye as well as by test.
 *
 *   node --experimental-strip-types scripts/plan-totals.ts
 */
import { FOODS, MEALS, TEMPLATES, templateTotals } from '../src/db/seed/plan-data.ts';

const pad = (v: number, w: number) => String(Math.round(v)).padStart(w);

console.log('day        kcal   prot   carb    fat');
for (const template of TEMPLATES) {
  const totals = templateTotals(template.key);
  console.log(
    template.key.padEnd(10),
    pad(totals.kcal, 4),
    pad(totals.proteinG, 6),
    pad(totals.carbsG, 6),
    pad(totals.fatG, 6),
  );
}

const mealKey = process.argv[2];
if (mealKey) {
  const meal = MEALS.find((m) => m.key === mealKey);
  if (!meal) throw new Error(`unknown meal "${mealKey}"`);
  console.log(`\n${meal.nameAr}:`);
  for (const [foodKey, servings] of meal.items) {
    const food = FOODS.find((f) => f.key === foodKey)!;
    console.log(`  ${food.nameAr.padEnd(26)} ${servings} × ${food.kcal} = ${pad(food.kcal * servings, 4)}`);
  }
}
