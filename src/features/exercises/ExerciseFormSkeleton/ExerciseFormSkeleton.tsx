import { Skeleton } from '@/components/ui/skeleton';

export function ExerciseFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-11 w-24 rounded-md" />
      <Skeleton className="h-10 w-56 max-w-full" />
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-[4/3] rounded-md" />
          <Skeleton className="aspect-[4/3] rounded-md" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
