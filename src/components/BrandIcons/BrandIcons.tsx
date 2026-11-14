import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BrandIconProps {
  className?: string;
  /** Gives the icon an accessible name; without it the icon is decorative. */
  title?: string;
}

function Svg({ className, title, children }: BrandIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6 shrink-0', className)}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {children}
    </svg>
  );
}

export function WorkoutIcon(props: BrandIconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 7 8.5 12 5.5 17 2.5 12Z" />
      <path d="M18.5 7 21.5 12 18.5 17 15.5 12Z" />
      <path d="M8.5 12h7" />
    </Svg>
  );
}

export function SetDoneIcon({ done, ...props }: BrandIconProps & { done?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M12 3 21 12 12 21 3 12Z" fill={done ? 'var(--accent)' : 'none'} />
      {done ? <path d="m8.5 12 2.5 2.5 4.5-5" /> : null}
    </Svg>
  );
}

export function RecordIcon(props: BrandIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 21 12 12 21 3 12Z" />
      <path d="M12 16V8.5" />
      <path d="m8.8 11.5 3.2-3.2 3.2 3.2" />
    </Svg>
  );
}

export function RestIcon(props: BrandIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V10" />
      <path d="m12 13.5 2.5 1.5" />
      <path d="M12 2.5 13.5 4 12 5.5 10.5 4Z" />
    </Svg>
  );
}

export function MyGymIcon(props: BrandIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5 15.5 12 12 15.5 8.5 12Z" />
    </Svg>
  );
}
