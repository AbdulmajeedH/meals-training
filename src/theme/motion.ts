import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Apple's motion model, translated to Reanimated.
 *
 * Apple describes a spring with two designer-facing numbers instead of the
 * mass/stiffness/damping triplet: `dampingRatio` (overshoot) and `response`
 * (how fast it reaches the target, in seconds). Reanimated's spring takes
 * exactly that pair as `dampingRatio` + `duration`, so the mapping is direct.
 *
 * House rule from `.claude/skills/apple-design`: critically damped (1.0)
 * everywhere by default. Bounce is earned only by a gesture that carried
 * momentum — a flick, a throw, a drag release. Overshoot on something that
 * merely faded in feels wrong.
 *
 * Every preset respects the OS reduce-motion setting.
 */

const base = { reduceMotion: ReduceMotion.System } as const;

export const spring = {
  /** Default for anything the user did not throw. Apple: damping 1.0 / response 0.4 */
  standard: { ...base, dampingRatio: 1, duration: 400 },

  /** Press-in / press-out scale. Fast enough to feel instant. */
  press: { ...base, dampingRatio: 1, duration: 220 },

  /** Value counters, rings, progress. Never bounces — a number that overshoots reads as wrong. */
  value: { ...base, dampingRatio: 1, duration: 500 },

  /** Sheets and drawers after a drag release. Apple: damping 0.8 / response 0.3 */
  sheet: { ...base, dampingRatio: 0.8, duration: 300 },

  /** Only after a flick or drag release, never on a plain tap. */
  momentum: { ...base, dampingRatio: 0.8, duration: 400 },
} satisfies Record<string, WithSpringConfig>;

/** Scale a control settles to while the finger is down. Feedback fires on press-IN. */
export const PRESS_SCALE = 0.96;

/**
 * Apple's momentum projection, from the *Designing Fluid Interfaces* sample code.
 * Projects where a flick would come to rest so we can snap to the target nearest
 * the projection rather than the nearest to the release point.
 *
 * Deliberately the exponential-decay form, not the textbook `v^2 / (2*decel)`.
 *
 * @param velocity px/s at release
 * @param decelerationRate 0.998 for normal scroll feel, 0.99 for snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Pick the snap point closest to `value`. */
export function nearestSnapPoint(value: number, points: readonly number[]): number {
  'worklet';
  let best = points[0];
  let bestDistance = Math.abs(value - best);
  for (let i = 1; i < points.length; i++) {
    const distance = Math.abs(value - points[i]);
    if (distance < bestDistance) {
      best = points[i];
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Rubber-banding for soft boundaries: motion past an edge keeps responding but
 * gives progressively less, so the boundary is felt instead of hit.
 *
 * @param offset how far past the edge the finger has travelled
 * @param dimension the size the resistance is measured against
 * @param coefficient 0.55 is the iOS value
 */
export function rubberBand(offset: number, dimension: number, coefficient = 0.55): number {
  'worklet';
  return (1 - 1 / ((offset * coefficient) / dimension + 1)) * dimension;
}
