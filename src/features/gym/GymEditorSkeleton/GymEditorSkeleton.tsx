import { Skeleton } from '@/components/ui/skeleton';

export function GymEditorSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-40 md:h-10" />
      <Skeleton className="h-5 w-full max-w-md" />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2">
        {[6, 6, 6].map((count, group) => (
          <div key={group} className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-soft">
            <Skeleton className="h-7 w-36" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: count }, (_, chip) => (
                <Skeleton key={chip} className="h-11 w-24 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
