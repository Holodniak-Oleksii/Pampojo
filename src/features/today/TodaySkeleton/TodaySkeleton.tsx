import { Skeleton } from '@/components/ui/skeleton';

export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
