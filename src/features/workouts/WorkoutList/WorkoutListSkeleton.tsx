import { Skeleton } from '@/components/ui/skeleton';

const ROWS = [0, 1, 2];

export function WorkoutListSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="workout-list-skeleton"
      className="divide-y divide-border rounded-lg bg-card lg:grid lg:grid-cols-3 lg:gap-4 lg:divide-y-0 lg:bg-transparent"
    >
      {ROWS.map((row) => (
        <div key={row} className="flex gap-3.5 p-3.5 lg:rounded-lg lg:bg-card lg:p-[18px]">
          <Skeleton className="size-[52px] shrink-0 rounded-sm" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
