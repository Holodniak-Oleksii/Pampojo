import { Skeleton } from '@/components/ui/skeleton';

const NAV_SLOTS = [0, 1, 2, 3, 4];

// Same geometry as AppShell, so swapping it in after the gate resolves does not move anything.
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-hidden="true">
      <div className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 px-4 py-6 lg:flex">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-14 w-full rounded-md" />
        <div className="flex flex-col gap-1">
          {NAV_SLOTS.map((slot) => (
            <Skeleton key={slot} className="h-11 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <div className="pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 w-full max-w-[960px] lg:mx-0 lg:max-w-none items-center gap-3 px-4 lg:px-8">
            <div className="-ml-1.5 flex size-11 items-center justify-center lg:hidden">
              <Skeleton className="size-8 rounded-md" />
            </div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="ml-auto h-8 w-20 rounded-md" />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[960px] lg:mx-0 lg:max-w-none flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-12">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-primary pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid h-[76px] max-w-[600px] grid-cols-5 items-center px-2">
          {NAV_SLOTS.map((slot) => (
            <div key={slot} className="flex justify-center">
              <Skeleton className="size-8 rounded-md bg-primary-foreground/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
