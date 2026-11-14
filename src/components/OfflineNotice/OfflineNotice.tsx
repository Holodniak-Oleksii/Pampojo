import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineNotice({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded-md bg-card px-4 py-3 ring-1 ring-border ring-inset text-sm font-semibold',
        className,
      )}
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  );
}
