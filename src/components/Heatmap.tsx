import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Text } from './Text';
import { fromIso, WEEKDAY_AR_SHORT, type IsoDate } from '@/lib/date';
import type { DayScore } from '@/lib/adherence';
import { useColors } from '@/theme';

type Props = {
  days: { date: IsoDate; score: DayScore }[];
  width: number;
};

const CELL = 30;
const GAP = 4;

/**
 * A month of adherence, one square per day.
 *
 * Weeks run down the columns and days of the week across the rows, mirrored so
 * that Sunday is on the right — the calendar reads right-to-left like the rest
 * of the app.
 *
 * Unscored days (before targets existed, or still in the future) are drawn as
 * empty outlines rather than dark squares, so "no data" never looks like "zero".
 */
export function Heatmap({ days, width }: Props) {
  const colors = useColors();
  if (days.length === 0) return null;

  const cell = Math.min(CELL, Math.floor((width - GAP * 6) / 7));
  const step = cell + GAP;

  const firstWeekday = fromIso(days[0].date).getDay();
  const rows = Math.ceil((firstWeekday + days.length) / 7);
  const height = rows * step;

  const fillFor = (score: DayScore): string => {
    if (!score.scored) return 'transparent';
    if (score.total >= 100) return colors.good;
    if (score.total >= 80) return colors.good + 'AA';
    if (score.total >= 50) return colors.warn + 'AA';
    if (score.total > 0) return colors.bad + '88';
    return colors.track;
  };

  return (
    <View style={{ gap: GAP }}>
      {/* Day-of-week headers, mirrored to match the grid below. */}
      <View style={{ flexDirection: 'row-reverse', width: 7 * step - GAP }}>
        {WEEKDAY_AR_SHORT.map((label) => (
          <View key={label} style={{ width: step, alignItems: 'center' }}>
            <Text variant="caption" color="textFaint">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Svg width={7 * step - GAP} height={height}>
        {days.map((day, index) => {
          const position = firstWeekday + index;
          const column = position % 7;
          const row = Math.floor(position / 7);
          // Mirror the column so weekday 0 (Sunday) sits at the right edge.
          const x = (6 - column) * step;
          const y = row * step;

          return (
            <Rect
              key={day.date}
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx={6}
              fill={fillFor(day.score)}
              stroke={day.score.scored ? 'none' : colors.border}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
    </View>
  );
}
