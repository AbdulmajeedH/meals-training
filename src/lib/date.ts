/**
 * Every date in this app is a local calendar day stored as `YYYY-MM-DD`.
 *
 * Deliberately never `toISOString()`: that converts to UTC first, so any user
 * east or west of Greenwich gets the wrong day for part of every day. All the
 * helpers here read the local components off the Date.
 */

export type IsoDate = string;

/** 0 = Sunday. The work week here runs Sunday–Thursday, so the week starts Sunday. */
export const WEEK_START_DAY = 0;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): IsoDate {
  return toIso(now);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = fromIso(b).getTime() - fromIso(a).getTime();
  // Round rather than floor: DST shifts make some "days" 23 or 25 hours long.
  return Math.round(ms / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. Matches `program_schedule.weekday`. */
export function weekday(iso: IsoDate): number {
  return fromIso(iso).getDay();
}

export function startOfWeek(iso: IsoDate): IsoDate {
  const offset = (weekday(iso) - WEEK_START_DAY + 7) % 7;
  return addDays(iso, -offset);
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Every day of the month `iso` falls in, in order. */
export function monthDates(iso: IsoDate): IsoDate[] {
  const date = fromIso(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`);
}

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const date = fromIso(startOfMonth(iso));
  date.setMonth(date.getMonth() + months);
  return toIso(date);
}

export const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const WEEKDAY_AR_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const MONTH_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function formatDayAr(iso: IsoDate): string {
  const date = fromIso(iso);
  return `${WEEKDAY_AR[date.getDay()]} ${date.getDate()} ${MONTH_AR[date.getMonth()]}`;
}

export function formatMonthAr(iso: IsoDate): string {
  const date = fromIso(iso);
  return `${MONTH_AR[date.getMonth()]} ${date.getFullYear()}`;
}
