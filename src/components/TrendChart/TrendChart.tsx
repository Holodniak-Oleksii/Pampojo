'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { useLocale } from '@/i18n/client';
import { formatNumber } from '@/i18n/format';

export interface ChartPoint {
  date: string;
  value: number;
}

const CONFIG = { value: { label: 'value', color: 'var(--accent)' } } satisfies ChartConfig;

/** About 4 round ticks that cover the values. */
function niceTicks(values: readonly number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const raw = span / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((s) => s >= raw) ?? raw;
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step)
    ticks.push(Math.round(tick * 100) / 100);
  return ticks;
}

/** The first point of each month, or every point when they all fall in about one month. */
function monthTicks(points: readonly ChartPoint[], dense: boolean): string[] {
  if (dense) return points.map((point) => point.date);
  const seen = new Set<string>();
  return points
    .filter((point) => {
      const month = point.date.slice(0, 7);
      if (seen.has(month)) return false;
      seen.add(month);
      return true;
    })
    .map((point) => point.date);
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

export default function TrendChart({
  points,
  dense,
}: {
  points: readonly ChartPoint[];
  /** One month or less: label every point with its day. */
  dense: boolean;
}) {
  const locale = useLocale();
  const last = points.length - 1;
  const ticks = niceTicks(points.map((point) => point.value));
  const tickDate = (date: string) =>
    new Intl.DateTimeFormat(locale, dense ? { day: 'numeric', month: 'short' } : { month: 'short' })
      .format(new Date(`${date}T12:00:00Z`))
      .replace(/\.$/, '');

  const renderDot = ({ cx, cy, index }: DotProps) => {
    if (cx === undefined || cy === undefined) return <g key={index} />;
    const lastPoint = index === last;
    const size = lastPoint ? 12 : 7;
    return (
      <rect
        key={index}
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        rx={lastPoint ? 2 : 1}
        transform={`rotate(45 ${cx} ${cy})`}
        fill={lastPoint ? 'var(--accent)' : 'var(--card)'}
        stroke={lastPoint ? 'none' : 'var(--accent)'}
        strokeWidth={1.5}
      />
    );
  };

  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-full w-full" aria-hidden="true">
      <LineChart data={[...points]} margin={{ top: 10, right: 4, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          type="category"
          ticks={monthTicks(points, dense)}
          tickFormatter={tickDate}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          fontSize={12}
        />
        <YAxis
          orientation="right"
          domain={[ticks[0] ?? 'auto', ticks.at(-1) ?? 'auto']}
          ticks={ticks}
          tickFormatter={(value: number) =>
            formatNumber(locale, value, { maximumFractionDigits: 1 })
          }
          tickLine={false}
          axisLine={false}
          width={40}
          fontSize={12}
        />
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--accent)"
          strokeWidth={points.length > 1 ? 2 : 0}
          strokeLinejoin="round"
          isAnimationActive={false}
          dot={renderDot}
          activeDot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
