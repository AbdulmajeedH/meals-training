/**
 * Numbers are always Western digits (0–9), never Arabic-Indic, even though the
 * whole UI is Arabic. Plain `toFixed`/`String` already produce Western digits —
 * the rule these helpers enforce is that nothing reaches for `toLocaleString`
 * with an Arabic locale, which would switch them.
 */

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Integer display: 1847 kcal, 143 g. */
export function n(value: number): string {
  return String(Math.round(value));
}

/** Up to `decimals` places, with trailing zeros dropped: 82.5 kg, 80 kg. */
export function d(value: number, decimals = 1): string {
  return String(round(value, decimals));
}

/** Signed, for deltas: +2.5, −140. Uses the real minus sign, not a hyphen. */
export function signed(value: number, decimals = 0): string {
  const rounded = round(value, decimals);
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${d(rounded, decimals)}` : `−${d(Math.abs(rounded), decimals)}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** mm:ss for the rest timer. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
