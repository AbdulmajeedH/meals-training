import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

/**
 * Bumps whenever any table changes. `enableChangeListener` is on in client.ts,
 * so every write anywhere in the app ticks this.
 */
function useDbVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const subscription = addDatabaseChangeListener(() => setVersion((v) => v + 1));
    return () => subscription.remove();
  }, []);

  return version;
}

/**
 * Run a synchronous read and re-run it after any database write.
 *
 * The expo-sqlite driver is synchronous, so screens can just read what they need
 * inside `run` and compose freely — no manual cache invalidation, and the
 * database stays the single source of truth.
 *
 * `deps` are the inputs `run` closes over (a date, an id). The listener is
 * table-agnostic, which is coarse but correct; the reads here are small and
 * local, and correctness beats shaving a re-render on a single-user app.
 */
export function useDbQuery<T>(run: () => T, deps: readonly unknown[]): T {
  const version = useDbVersion();
  // Collapsed to one scalar so the dependency list stays an array literal.
  // `deps` are plain values (dates, ids), so serialising them is cheap and exact.
  const key = `${version}:${JSON.stringify(deps)}`;
  // `run` is intentionally absent from the dependency list: callers pass a fresh
  // closure every render, and `key` already tracks everything it reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => run(), [key]);
}
