import { Skeleton } from '@/components/ui/skeleton';

export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-9 w-56 md:h-10" />
      </div>
      <Skeleton className="h-48 w-full rounded-[32px]" />
    </div>
  );
}
