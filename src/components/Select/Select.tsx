import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A native select styled like `Input`, with the chevron inset from the edge. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        className="h-12 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pr-12 pl-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-5 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
