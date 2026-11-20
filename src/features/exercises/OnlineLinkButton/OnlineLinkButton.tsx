'use client';

import { WifiOff } from 'lucide-react';
import Link from 'next/link';
import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { OnlineOnly } from '@/features/offline/OnlineOnly';
import { useIsOnline } from '@/hooks/useIsOnline';

export interface OnlineLinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
  /** For an icon-only button. */
  ariaLabel?: string;
  /** The visible label, for the blocked name of a button with text. */
  label?: string;
}

const isDecorativeIcon = (child: ReactNode) =>
  isValidElement<{ 'aria-hidden'?: unknown }>(child) &&
  (child.props['aria-hidden'] === true || child.props['aria-hidden'] === 'true');

/** A link styled as a button. Offline it is blocked with the WifiOff icon (spec 17). */
export function OnlineLinkButton({
  href,
  children,
  variant,
  size,
  className,
  ariaLabel,
  label,
}: OnlineLinkButtonProps) {
  const online = useIsOnline();
  const iconOnly = ariaLabel !== undefined;
  // A labelled button leads with WifiOff offline, in place of its own icon.
  const content =
    online || iconOnly
      ? children
      : [
          <WifiOff key="offline" aria-hidden="true" />,
          ...Children.toArray(children).filter((child) => !isDecorativeIcon(child)),
        ];

  return (
    <OnlineOnly
      label={ariaLabel ?? label ?? ''}
      kind={iconOnly ? 'icon' : 'label'}
      wrapperClassName={className}
    >
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={href}>{content}</Link>
      </Button>
    </OnlineOnly>
  );
}
