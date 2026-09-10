import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import * as schema from './schema';

export const DATABASE_NAME = 'meals-training.db';

/**
 * One connection for the whole app. `expo-sqlite` is happy with a single
 * synchronous handle, and the database — not any store — is the source of truth.
 *
 * `enableChangeListener` is what makes drizzle's `useLiveQuery` re-run when a
 * write lands, so screens update without any manual invalidation.
 */
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

// Foreign keys are off by default in SQLite and the schema leans on them
// (cascades on meal items, set logs, template slots).
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export { migrations, schema };

export type Database = typeof db;
