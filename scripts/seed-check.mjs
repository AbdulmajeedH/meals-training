/**
 * Applies the migration to a real SQLite database and replays both seeds — the
 * nutrition plan and the training program — against it.
 *
 * The *-data.test.ts files check the seeds' arithmetic and structure; this
 * checks they can actually be written. Foreign keys resolve, the
 * (template_id, slot) unique index holds, the day totals read back through SQL
 * as the plan intends, opening a training day pre-fills the right number of
 * sets, and the plank keeps its unit. Those failures only appear at insert
 * time, and on a phone they would appear on first launch.
 *
 *   node --experimental-strip-types scripts/seed-check.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

import { FOODS, MEALS, TARGET, TEMPLATES, templateTotals } from '../src/db/seed/plan-data.ts';
import { PROGRAM_DAYS } from '../src/db/seed/program-data.ts';

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

/* ---------------------------------------------------------- the program */

const insertDay = db.prepare('INSERT INTO program_days (name, sort, archived) VALUES (?, ?, 0)');
const insertExercise = db.prepare(
  'INSERT INTO exercises (program_day_id, name, sets, rep_min, rep_max, rest_sec, rep_unit, notes, sort, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
);

const dayIds = new Map();
PROGRAM_DAYS.forEach((day, dayIndex) => {
  const id = Number(insertDay.run(day.name, dayIndex).lastInsertRowid);
  dayIds.set(day.key, id);
  day.exercises.forEach((exercise, index) => {
    insertExercise.run(
      id,
      exercise.name,
      exercise.sets,
      exercise.repMin,
      exercise.repMax,
      exercise.restSec,
      exercise.repUnit ?? 'reps',
      exercise.notes,
      index,
    );
  });
});

const exerciseCount = db.prepare('SELECT count(*) c FROM exercises').get().c;
const expectedExercises = PROGRAM_DAYS.reduce((total, day) => total + day.exercises.length, 0);
console.log('seeded:', PROGRAM_DAYS.length, 'program days,', exerciseCount, 'exercises');
if (exerciseCount !== expectedExercises) {
  fail(`expected ${expectedExercises} exercises, found ${exerciseCount}`);
}

// The schedule must stay empty: the program never says which weekdays to train,
// so seeding one would be invented data.
const scheduled = db.prepare('SELECT count(*) c FROM program_schedule').get().c;
if (scheduled !== 0) fail('the seed assigned weekdays the program does not specify');
else console.log('ok  weekly schedule left for the user to choose');

// Simulate opening Day 01: create the session and pre-fill every set, the way
// ensureSession does. This is what happens on the first tap of the app.
const day01 = dayIds.get('day01');
const sessionId = Number(
  db
    .prepare("INSERT INTO workout_sessions (date, program_day_id, status) VALUES ('2026-09-12', ?, 'planned')")
    .run(day01).lastInsertRowid,
);
const planned = db
  .prepare('SELECT id, sets, rep_min FROM exercises WHERE program_day_id = ? ORDER BY sort')
  .all(day01);
const insertSet = db.prepare(
  'INSERT INTO set_logs (session_id, exercise_id, set_no, weight_kg, reps, done) VALUES (?, ?, ?, NULL, ?, 0)',
);
for (const exercise of planned) {
  for (let setNo = 1; setNo <= exercise.sets; setNo++) {
    insertSet.run(sessionId, exercise.id, setNo, exercise.rep_min);
  }
}

const setCount = db.prepare('SELECT count(*) c FROM set_logs WHERE session_id = ?').get(sessionId).c;
const expectedSets = PROGRAM_DAYS[0].exercises.reduce((total, e) => total + e.sets, 0);
if (setCount !== expectedSets) fail(`Day 01 pre-filled ${setCount} sets, expected ${expectedSets}`);
else console.log('ok  opening Day 01 pre-fills', setCount, 'sets');

// The plank's 60 must be stored as a duration, not mistaken for 60 reps.
const plank = db.prepare("SELECT rep_unit, rep_min FROM exercises WHERE name = 'Plank'").get();
if (!plank || plank.rep_unit !== 'seconds' || plank.rep_min !== 60) {
  fail('the plank is not stored as a 60 second hold');
} else {
  console.log('ok  plank stored as a 60 second hold');
}

const fkAfterProgram = db.prepare('PRAGMA foreign_key_check').all();
if (fkAfterProgram.length > 0) fail(`${fkAfterProgram.length} foreign key violations after program`);

console.log(failures === 0 ? '\nALL SEED CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
