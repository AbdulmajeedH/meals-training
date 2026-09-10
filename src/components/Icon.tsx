import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The five tab glyphs, drawn by hand rather than pulling in an icon font.
 * All are 24×24, stroke-only, so a single `color` drives both states.
 */
export type IconName = 'today' | 'meals' | 'training' | 'progress' | 'settings';

const PATHS: Record<IconName, string[]> = {
  // Sun over a horizon — "today".
  today: ['M4 18h16', 'M7 18a5 5 0 0 1 10 0', 'M12 4v2', 'M5.6 7.6 7 9', 'M18.4 7.6 17 9'],
  // Bowl with steam.
  meals: ['M4 12h16a8 8 0 0 1-16 0Z', 'M10 4c-1 1.2-1 2.4 0 3.6', 'M14 4c-1 1.2-1 2.4 0 3.6'],
  // Dumbbell.
  training: ['M3 9v6', 'M21 9v6', 'M6.5 6v12', 'M17.5 6v12', 'M6.5 12h11'],
  // Rising bars.
  progress: ['M4 20V13', 'M10 20V8', 'M16 20v-5', 'M22 20V4'],
  // Sliders.
  settings: ['M4 8h10', 'M18 8h2', 'M4 16h4', 'M12 16h8'],
};

/** Icons that need a circle drawn on top of their paths. */
const KNOBS: Partial<Record<IconName, { cx: number; cy: number }[]>> = {
  settings: [
    { cx: 16, cy: 8 },
    { cx: 10, cy: 16 },
  ],
};

type Props = {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function Icon({ name, color, size = 24, strokeWidth = 1.9 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {KNOBS[name]?.map((knob) => (
        <Circle
          key={`${knob.cx}-${knob.cy}`}
          cx={knob.cx}
          cy={knob.cy}
          r={2.2}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ))}
    </Svg>
  );
}
