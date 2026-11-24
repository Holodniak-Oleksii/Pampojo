'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { type MeasurementType } from '@/constants/measurement';
import { SEX, type Sex, type UnitSystem } from '@/constants/profile';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { Measurement } from '@/shared/schemas/measurement';
import { formatMeasurement, measurementHref, shortName, typeName } from '../utils';
import { FemaleFigure, MaleFigure } from './figures';
import { DIAGRAM, diagramRings, type Ring } from './geometry';

export interface BodyDiagramProps {
  sex: Sex;
  latest: ReadonlyMap<MeasurementType, Measurement | undefined>;
  units: UnitSystem;
}

export function BodyDiagram({ sex, latest, units }: BodyDiagramProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const rings = diagramRings(sex);
  const Figure = sex === SEX.FEMALE ? FemaleFigure : MaleFigure;

  return (
    <div className="relative mx-auto h-[400px] w-[358px] max-w-full shrink-0">
      <Figure className="absolute top-0 left-[102px] h-[400px] w-[154px] text-figure" />
      <svg
        aria-hidden="true"
        width={DIAGRAM.width}
        height={DIAGRAM.height}
        viewBox={`0 0 ${DIAGRAM.width} ${DIAGRAM.height}`}
        className="absolute inset-0"
        fill="none"
        strokeLinecap="round"
      >
        {rings.map((ring) => (
          <RingMarks key={ring.type} ring={ring} />
        ))}
      </svg>
      {rings.map((ring) => {
        const row = latest.get(ring.type);
        const value = row ? formatMeasurement(t, locale, ring.type, row.value, units) : '—';
        const left = ring.side === 'left';
        return (
          <Link
            key={ring.type}
            href={measurementHref(ring.type)}
            aria-label={`${typeName(t, ring.type)}: ${value}`}
            className={cn(
              'absolute flex flex-col rounded-sm bg-card px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              // The chip is 38px tall; the pseudo element extends the touch target to 46px.
              'before:absolute before:inset-x-0 before:-inset-y-1',
              left ? 'items-end text-right' : 'items-start',
            )}
            style={{
              top: ring.chipY - DIAGRAM.chipHalf,
              ...(left ? { right: DIAGRAM.rightEdge } : { left: DIAGRAM.rightEdge }),
            }}
          >
            <span className="text-[11px] leading-[14px] whitespace-nowrap text-muted-foreground">
              {shortName(t, ring.type)}
            </span>
            <span className="text-[13px] leading-4 font-bold whitespace-nowrap tabular-nums">
              {value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function RingMarks({ ring }: { ring: Ring }) {
  const left = ring.cx - ring.rx;
  const right = ring.cx + ring.rx;
  const arc = (sweep: 0 | 1) =>
    `M${left} ${ring.cy} A${ring.rx} ${ring.ry} 0 0 ${sweep} ${right} ${ring.cy}`;
  const start = ring.side === 'left' ? DIAGRAM.leftEdge : DIAGRAM.rightEdge;
  const knee = ring.side === 'left' ? start + DIAGRAM.knee : start - DIAGRAM.knee;
  return (
    <g>
      <path d={arc(1)} stroke="var(--tape-back)" strokeWidth={0.9} strokeDasharray="2 2.5" />
      <path d={arc(0)} stroke="var(--tape)" strokeWidth={1.2} />
      <path
        d={`M${start} ${ring.chipY} L${knee} ${ring.chipY} L${ring.endX} ${ring.cy}`}
        stroke="var(--planned)"
        strokeWidth={1}
      />
      <rect
        x={ring.endX - 3}
        y={ring.cy - 3}
        width={6}
        height={6}
        rx={1}
        fill="var(--tape)"
        transform={`rotate(45 ${ring.endX} ${ring.cy})`}
      />
    </g>
  );
}
