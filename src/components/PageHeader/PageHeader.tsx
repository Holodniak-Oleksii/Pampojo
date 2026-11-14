import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  /** The title repeats the section name the mobile top bar already shows, so phones hide it visually. */
  sectionTitle?: boolean;
  /** A decorative icon before the title. */
  icon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  sectionTitle,
  icon,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          className={cn(
            'flex items-center gap-3 text-3xl font-extrabold md:text-4xl',
            sectionTitle && 'max-lg:sr-only',
          )}
        >
          {icon}
          {title}
        </h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
