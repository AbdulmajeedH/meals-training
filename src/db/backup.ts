import { db, sqlite } from '@/db/client';

/**
 * Whole-database export and import as JSON.
 *
 * Row-shaped rather than a binary SQLite copy, so a backup stays readable and
 * survives a schema migration: an import fills the columns it recognises and
 * ignores the rest.
 */

export const BACKUP_VERSION = 1;

/**
 * Order matters on import: parents before the rows that reference them.
 *
 * Kept in step with the schema by scripts/schema-check.mjs, which fails if the
 * migration creates a table this list does not mention — a forgotten table
 * would otherwise silently drop out of every backup.
 */
const TABLES = [
  'targets',
  'foods',
  'meals',
  'meal_items',
  'day_templates',
  'day_template_slots',
  'week_plan',
  'meal_logs',
  'meal_log_items',
  'program_days',
  'exercises',
  'program_schedule',
  'workout_sessions',
  'set_logs',
  'body_weight',
  'weekly_reviews',
  'settings',
  'personal_bests',
] as const;

type TableName = (typeof TABLES)[number];

export type Backup = {
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export function exportBackup(): Backup {
  const tables: Backup['tables'] = {};
  for (const table of TABLES) {
    tables[table] = sqlite.getAllSync(`SELECT * FROM ${table}`) as Record<string, unknown>[];
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export type ImportResult =
  | { ok: true; rows: number }
  | { ok: false; reason: 'bad_shape' | 'unsupported_version' | 'failed'; message?: string };

/** Cheap shape check before anything is deleted. */
export function validateBackup(value: unknown): value is Backup {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Backup>;
  if (typeof candidate.version !== 'number') return false;
  if (typeof candidate.tables !== 'object' || candidate.tables === null) return false;
  return Object.values(candidate.tables).every(Array.isArray);
}

/**
 * Replace the entire database with a backup.
 *
 * Everything runs in one transaction with foreign keys deferred, so a partial
 * or malformed backup leaves the existing data untouched rather than half
 * overwritten. Foreign keys are re-checked before the commit.
 */
export function importBackup(value: unknown): ImportResult {
  if (!validateBackup(value)) return { ok: false, reason: 'bad_shape' };
  if (value.version > BACKUP_VERSION) return { ok: false, reason: 'unsupported_version' };

  let rows = 0;

  try {
    sqlite.execSync('PRAGMA foreign_keys = OFF;');
    db.transaction(() => {
      // Children first, so restrict constraints do not fire during the wipe.
      for (const table of [...TABLES].reverse()) {
        sqlite.execSync(`DELETE FROM ${table}`);
      }

      for (const table of TABLES) {
        const records = value.tables[table];
        if (!Array.isArray(records) || records.length === 0) continue;

        for (const record of records) {
          if (typeof record !== 'object' || record === null) continue;
          const columns = Object.keys(record);
          if (columns.length === 0) continue;

          const placeholders = columns.map(() => '?').join(', ');
          const statement = sqlite.prepareSync(
            `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
          );
          try {
            statement.executeSync(columns.map((column) => record[column] as never));
            rows++;
          } finally {
            statement.finalizeSync();
          }
        }
      }

      // Surfaces a broken backup as a thrown error, which rolls the whole
      // transaction back rather than leaving dangling references behind.
      const violations = sqlite.getAllSync('PRAGMA foreign_key_check');
      if (violations.length > 0) {
        throw new Error(`foreign key violations: ${violations.length}`);
      }
    });

    return { ok: true, rows };
  } catch (error) {
    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    sqlite.execSync('PRAGMA foreign_keys = ON;');
  }
}

/** Row counts per table, for showing what a backup contains before restoring. */
export function backupSummary(backup: Backup): { table: TableName; rows: number }[] {
  return TABLES.map((table) => ({ table, rows: backup.tables[table]?.length ?? 0 })).filter(
    (entry) => entry.rows > 0,
  );
}

export { TABLES };
export type { TableName };
