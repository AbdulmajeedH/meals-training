import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

const file = readdirSync('drizzle').find((f) => f.endsWith('.sql'));
const sql = readFileSync(`drizzle/${file}`, 'utf8');
for (const stmt of sql.split('--> statement-breakpoint')) {
  if (stmt.trim()) db.exec(stmt);
}

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).all().map((r) => r.name);
console.log('tables:', tables.length, tables.join(', '));

// Exercise the FK graph and the unique constraints the app relies on.
db.exec("INSERT INTO program_days (id, name, sort) VALUES (1, 'Push', 0)");
db.exec("INSERT INTO exercises (id, program_day_id, name, sets, rep_min, rep_max, rest_sec, sort) VALUES (1, 1, 'Bench', 3, 8, 12, 120, 0)");
db.exec("INSERT INTO program_schedule (weekday, program_day_id) VALUES (0, 1)");
db.exec("INSERT INTO workout_sessions (id, date, program_day_id, status) VALUES (1, '2026-09-10', 1, 'planned')");
db.exec("INSERT INTO set_logs (session_id, exercise_id, set_no, weight_kg, reps, done) VALUES (1, 1, 1, 80, 10, 0)");

let failures = 0;
const mustFail = (label, fn) => {
  try { fn(); console.log('FAIL (no error):', label); failures++; }
  catch { console.log('ok  rejected:', label); }
};

mustFail('duplicate session date', () =>
  db.exec("INSERT INTO workout_sessions (date, program_day_id, status) VALUES ('2026-09-10', 1, 'planned')"));
mustFail('duplicate set number', () =>
  db.exec("INSERT INTO set_logs (session_id, exercise_id, set_no, done) VALUES (1, 1, 1, 0)"));
mustFail('set log for a missing session', () =>
  db.exec("INSERT INTO set_logs (session_id, exercise_id, set_no, done) VALUES (99, 1, 1, 0)"));
mustFail('meal item for a missing food', () => {
  db.exec("INSERT INTO meals (id, name_ar) VALUES (1, 'وجبة')");
  db.exec("INSERT INTO meal_items (meal_id, food_id, servings) VALUES (1, 42, 1)");
});
mustFail('two logs in the same date+slot', () => {
  db.exec("INSERT INTO meal_logs (date, slot, status) VALUES ('2026-09-10', 'lunch', 'planned')");
  db.exec("INSERT INTO meal_logs (date, slot, status) VALUES ('2026-09-10', 'lunch', 'planned')");
});

// A day with logged sessions must refuse deletion, so history survives edits.
mustFail('deleting a program day that has sessions', () =>
  db.exec('DELETE FROM program_days WHERE id = 1'));

// With the history gone, the same delete must succeed and cascade cleanly.
db.exec('DELETE FROM set_logs');
db.exec('DELETE FROM workout_sessions');
db.exec('DELETE FROM program_days WHERE id = 1');
const leftExercises = db.prepare('SELECT count(*) c FROM exercises').get().c;
const scheduleRow = db.prepare('SELECT program_day_id p FROM program_schedule WHERE weekday = 0').get().p;
console.log('after clean delete — exercises:', leftExercises, 'schedule slot:', scheduleRow);
if (leftExercises !== 0) { console.log('FAIL: exercises not cascaded'); failures++; }
if (scheduleRow !== null) { console.log('FAIL: schedule not nulled'); failures++; }

// The backup must cover every table; a table missing from that list would be
// silently absent from every export.
const backupSource = readFileSync('src/db/backup.ts', 'utf8');
const listed = new Set(
  (backupSource.match(/const TABLES = \[([\s\S]*?)\] as const;/)?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^'|'$/g, ''))
    .filter(Boolean),
);
const missing = tables.filter((name) => !listed.has(name));
const extra = [...listed].filter((name) => !tables.includes(name));
if (missing.length) { console.log('FAIL: not in backup TABLES:', missing.join(', ')); failures++; }
if (extra.length) { console.log('FAIL: in backup TABLES but not in schema:', extra.join(', ')); failures++; }
if (!missing.length && !extra.length) console.log('ok  backup covers all', tables.length, 'tables');

console.log(failures === 0 ? '\nALL SCHEMA CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
