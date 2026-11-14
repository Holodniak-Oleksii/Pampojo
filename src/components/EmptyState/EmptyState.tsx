import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg bg-card p-8 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-7 text-muted-foreground" />
      <h2 className="text-xl font-extrabold">{title}</h2>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
