import { Skeleton } from '@/components/ui/skeleton';

export function AuthCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6 rounded-lg bg-card p-6 md:p-8">
      <Skeleton className="h-12 rounded-md" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-14 rounded-md" />
      <Skeleton className="h-12 rounded-md" />
      <Skeleton className="h-12 rounded-md" />
      <Skeleton className="h-14 rounded-md" />
    </div>
  );
}
