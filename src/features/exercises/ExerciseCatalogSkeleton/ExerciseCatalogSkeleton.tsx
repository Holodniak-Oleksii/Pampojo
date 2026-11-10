import { Skeleton } from '@/components/ui/skeleton';

const ROWS = [0, 1, 2, 3, 4, 5];

export function ExerciseCatalogSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="exercise-catalog-skeleton"
      className="grid gap-2 lg:grid-cols-2 lg:gap-4 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {ROWS.map((row) => (
        <Skeleton key={row} className="h-[72px] rounded-[20px] lg:h-72" />
      ))}
    </div>
  );
}
