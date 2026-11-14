import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: { direction: 'up' | 'down'; text: string };
  children?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, unit, trend, children, className }: StatCardProps) {
  const TrendIcon = trend?.direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg bg-card p-5', className)}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-extrabold tabular-nums">
          <span>{value}</span>
          {unit ? <span className="ml-1 text-base font-semibold">{unit}</span> : null}
        </p>
        {trend ? (
          <p className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <TrendIcon aria-hidden="true" className="size-4" />
            {trend.text}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
