import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-10 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-14 w-full rounded-3xl" />
      <Skeleton className="h-14 w-full rounded-3xl" />
      <Skeleton className="h-14 w-full rounded-3xl" />
    </div>
  );
}
