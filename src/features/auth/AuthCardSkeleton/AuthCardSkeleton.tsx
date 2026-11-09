import { Skeleton } from '@/components/ui/skeleton';

export function AuthCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6 rounded-[24px] bg-card p-6 shadow-soft md:p-8"
    >
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-14 rounded-full" />
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-14 rounded-full" />
    </div>
  );
}
