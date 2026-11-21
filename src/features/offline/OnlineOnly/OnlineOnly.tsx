'use client';

import { WifiOff } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';

export const NEEDS_INTERNET_TOAST_ID = 'needs-internet';

export interface OnlineOnlyProps {
  /** The visible label, or the name of an icon-only control. */
  label: string;
  /** `icon` adds the corner badge; `label` expects the call site to lead with the WifiOff icon. */
  kind: 'icon' | 'label';
  /** Layout classes for the badge wrapper of an icon control, such as `lg:hidden`. */
  wrapperClassName?: string;
  children: ReactElement;
}

export function showNeedsInternet(message: string) {
  toast(message, {
    id: NEEDS_INTERNET_TOAST_ID,
    duration: 2000,
    icon: <WifiOff aria-hidden="true" className="size-[18px] text-accent" />,
    className: '!bg-foreground !text-card !border-transparent !rounded-lg',
  });
}

/**
 * Blocks a control that needs the network. Offline, the control keeps the focus and the tap, so the
 * user gets a toast that says why, instead of a dead button.
 */
export function OnlineOnly({ label, kind, wrapperClassName, children }: OnlineOnlyProps) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const desktop = useIsDesktop();

  if (online) {
    return kind === 'icon' ? <Slot.Root aria-label={label}>{children}</Slot.Root> : children;
  }

  const block = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    showNeedsInternet(t('Needs internet'));
  };
  const blocked = (
    <Slot.Root
      aria-disabled="true"
      aria-label={t('{{label}}. Needs internet', { label })}
      data-blocked=""
      onClickCapture={block}
      onKeyDownCapture={(event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') block(event);
      }}
      onPointerDownCapture={(event: MouseEvent) => event.preventDefault()}
    >
      {children}
    </Slot.Root>
  );
  const content =
    kind === 'icon' ? (
      <span className={cn('relative inline-flex', wrapperClassName)}>
        {blocked}
        <span
          aria-hidden="true"
          data-testid="offline-badge"
          className="pointer-events-none absolute -top-[7px] -right-[7px] flex size-5 items-center justify-center rounded-md bg-foreground text-card ring-2 ring-background"
        >
          <WifiOff className="size-3" strokeWidth={2.4} />
        </span>
      </span>
    ) : (
      blocked
    );

  if (!desktop) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="bottom">{t('Needs internet')}</TooltipContent>
    </Tooltip>
  );
}
