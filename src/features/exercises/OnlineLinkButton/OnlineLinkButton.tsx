'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';

export interface OnlineLinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
}

/** A link styled as a button that turns into a disabled button with a hint while offline. */
export function OnlineLinkButton({
  href,
  children,
  variant,
  size,
  className,
}: OnlineLinkButtonProps) {
  const { t } = useTranslation();
  const online = useIsOnline();

  if (!online) {
    return (
      <span className={cn('flex flex-col items-start gap-1', className)}>
        <Button variant={variant} size={size} disabled>
          {children}
        </Button>
        <span className="text-sm text-muted-foreground">{t('Needs internet')}</span>
      </span>
    );
  }
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
