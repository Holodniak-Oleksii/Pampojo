import { Skeleton } from '@/components/ui/skeleton';

export function ExerciseDetailsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-11 w-32 rounded-md" />
      <Skeleton className="h-10 w-64 max-w-full" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-8">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
