import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineNotice({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold',
        className,
      )}
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  );
}
