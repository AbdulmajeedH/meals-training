import Svg, { Circle, Line, Path } from 'react-native-svg';

import { movingAverage } from '@/lib/adherence';
import type { IsoDate } from '@/lib/date';
import { useColors } from '@/theme';

type Props = {
  points: { date: IsoDate; kg: number }[];
  width: number;
  height?: number;
};

/**
 * Body weight over time: raw readings as faint dots, the 7-day average as the
 * line. The average is the signal — a single morning reading moves on water and
 * salt, which is why the plan asks for weekly averages.
 *
 * RTL: time runs right to left, so the newest reading sits at the left edge.
 */
export function WeightTrend({ points, width, height = 160 }: Props) {
  const colors = useColors();
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const smoothed = movingAverage(sorted);

  const padding = { top: 12, bottom: 12, left: 8, right: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = [...sorted.map((p) => p.kg), ...smoothed.map((p) => p.kg)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it a 1 kg window so the line centres.
  const span = max - min < 0.5 ? 1 : max - min;
  const mid = (max + min) / 2;
  const low = max - min < 0.5 ? mid - 0.5 : min;

  const x = (index: number) =>
    // Mirrored: index 0 (oldest) at the right.
    padding.left + plotWidth - (index / (sorted.length - 1)) * plotWidth;
  const y = (kg: number) => padding.top + plotHeight - ((kg - low) / span) * plotHeight;

  const path = smoothed
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.kg)}`)
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Line
        x1={padding.left}
        y1={y(low + span / 2)}
        x2={width - padding.right}
        y2={y(low + span / 2)}
        stroke={colors.border}
        strokeWidth={1}
        strokeDasharray="3 5"
      />

      {sorted.map((point, index) => (
        <Circle key={point.date} cx={x(index)} cy={y(point.kg)} r={2.5} fill={colors.textFaint} />
      ))}

      <Path
        d={path}
        stroke={colors.accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <Circle
        cx={x(smoothed.length - 1)}
        cy={y(smoothed[smoothed.length - 1].kg)}
        r={4.5}
        fill={colors.accent}
      />
    </Svg>
  );
}
