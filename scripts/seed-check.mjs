/**
 * Applies the migration to a real SQLite database and replays the seeded
 * nutrition plan against it.
 *
 * plan-data.test.ts checks the plan's arithmetic; this checks that the plan can
 * actually be written — foreign keys resolve, the (template_id, slot) unique
 * index holds, and the day log reads back the macros the plan intends. Those
 * are constraint failures that only appear at insert time, and on a phone they
 * would appear on first launch.
 *
 *   node --experimental-strip-types scripts/seed-check.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

import { FOODS, MEALS, TARGET, TEMPLATES, templateTotals } from '../src/db/seed/plan-data.ts';

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

const file = readdirSync('drizzle').find((name) => name.endsWith('.sql'));
for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint')) {
  if (statement.trim()) db.exec(statement);
}

let failures = 0;
const fail = (message) => {
  console.log('FAIL:', message);
  failures++;
};

/* ------------------------------------------------------------------- seed */

const foodIds = new Map();
const insertFood = db.prepare(
  'INSERT INTO foods (name_ar, serving_label, kcal, protein_g, carbs_g, fat_g, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
);
for (const food of FOODS) {
  const info = insertFood.run(
    food.nameAr,
    food.servingLabel,
    food.kcal,
    food.proteinG,
    food.carbsG,
    food.fatG,
  );
  foodIds.set(food.key, Number(info.lastInsertRowid));
}

const mealIds = new Map();
const insertMeal = db.prepare('INSERT INTO meals (name_ar, archived, created_at) VALUES (?, 0, 0)');
const insertMealItem = db.prepare(
  'INSERT INTO meal_items (meal_id, food_id, servings, sort) VALUES (?, ?, ?, ?)',
);
for (const meal of MEALS) {
  const id = Number(insertMeal.run(meal.nameAr).lastInsertRowid);
  mealIds.set(meal.key, id);
  meal.items.forEach(([foodKey, servings], index) => {
    insertMealItem.run(id, foodIds.get(foodKey), servings, index);
  });
}

const templateIds = new Map();
const insertTemplate = db.prepare('INSERT INTO day_templates (name_ar, day_type) VALUES (?, ?)');
const insertSlot = db.prepare(
  'INSERT INTO day_template_slots (template_id, slot, meal_id, sort) VALUES (?, ?, ?, ?)',
);
for (const template of TEMPLATES) {
  const id = Number(insertTemplate.run(template.nameAr, template.dayType).lastInsertRowid);
  templateIds.set(template.key, id);
  template.slots.forEach(([slot, mealKey], index) => {
    insertSlot.run(id, slot, mealIds.get(mealKey), index);
  });
}

for (const dayType of ['training', 'rest', 'busy']) {
  db.prepare(
    'INSERT INTO targets (day_type, kcal, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?)',
  ).run(dayType, TARGET.kcal, TARGET.proteinG, TARGET.carbsG, TARGET.fatG);
}

console.log(
  'seeded:',
  FOODS.length,
  'foods,',
  MEALS.length,
  'meals,',
  TEMPLATES.length,
  'templates',
);

/* ---------------------------------------------------------------- checks */

const violations = db.prepare('PRAGMA foreign_key_check').all();
if (violations.length > 0) fail(`${violations.length} foreign key violations`);
else console.log('ok  no foreign key violations');

// The same query shape the app uses to total a planned day.
const dayTotal = db.prepare(`
  SELECT
    SUM(f.kcal      * mi.servings) AS kcal,
    SUM(f.protein_g * mi.servings) AS protein
  FROM day_template_slots dts
  JOIN meal_items mi ON mi.meal_id = dts.meal_id
  JOIN foods f       ON f.id = mi.food_id
  WHERE dts.template_id = ?
`);

for (const template of TEMPLATES) {
  const row = dayTotal.get(templateIds.get(template.key));
  const expected = templateTotals(template.key);

  if (Math.abs(row.kcal - expected.kcal) > 0.5) {
    fail(`${template.key}: database says ${Math.round(row.kcal)} kcal, plan says ${Math.round(expected.kcal)}`);
  }
  if (Math.abs(row.protein - expected.proteinG) > 0.5) {
    fail(`${template.key}: database says ${Math.round(row.protein)} g protein, plan says ${Math.round(expected.proteinG)}`);
  }
}
console.log('ok  every template totals the same in SQL as in the plan data');

// A meal reused across templates must not be duplicated in the library.
const mealCount = db.prepare('SELECT count(*) c FROM meals').get().c;
if (mealCount !== MEALS.length) fail(`expected ${MEALS.length} meals, found ${mealCount}`);
else console.log('ok  shared meals stored once:', mealCount);

// Reusing a meal in two templates is legal; reusing a slot within one is not.
try {
  insertSlot.run(templateIds.get('sat'), 'lunch', mealIds.get('sun_lunch'), 9);
  fail('a duplicate slot in one template was accepted');
} catch {
  console.log('ok  rejected: two meals in the same template slot');
}

// Every seeded food is actually used; an unused one is dead weight in pickers.
const unused = db
  .prepare('SELECT name_ar FROM foods WHERE id NOT IN (SELECT food_id FROM meal_items)')
  .all();
if (unused.length > 0) fail(`unused foods: ${unused.map((r) => r.name_ar).join(', ')}`);
else console.log('ok  every seeded food is used by a meal');

console.log(failures === 0 ? '\nALL SEED CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
