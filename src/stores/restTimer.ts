import { create } from 'zustand';

/**
 * Rest timer state. Deliberately not in the database: it is pure UI, it dies
 * with the app, and nothing about the log depends on it.
 *
 * Stores an absolute end timestamp rather than a countdown, so the display stays
 * correct if the app is backgrounded and the interval stops firing.
 */
type RestTimerState = {
  endsAt: number | null;
  totalSec: number;
  label: string | null;
  start: (seconds: number, label: string) => void;
  extend: (seconds: number) => void;
  stop: () => void;
};

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  totalSec: 0,
  label: null,

  start: (seconds, label) =>
    set({ endsAt: Date.now() + seconds * 1000, totalSec: seconds, label }),

  extend: (seconds) => {
    const { endsAt, totalSec } = get();
    if (endsAt == null) return;
    // Extend from now if it already elapsed, so "+30s" always gives a full 30s.
    const base = Math.max(endsAt, Date.now());
    set({ endsAt: base + seconds * 1000, totalSec: totalSec + seconds });
  },

  stop: () => set({ endsAt: null, totalSec: 0, label: null }),
}));

export function remainingSeconds(endsAt: number | null, now: number = Date.now()): number {
  if (endsAt == null) return 0;
  return Math.max(0, (endsAt - now) / 1000);
}
