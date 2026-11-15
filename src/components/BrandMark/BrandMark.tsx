import Image from 'next/image';
import { cn } from '@/lib/utils';

const SOURCES = {
  wordmark: { light: '/brand/pampojo-wordmark.svg', dark: '/brand/pampojo-wordmark-dark.svg' },
  icon: { light: '/brand/pampojo-icon.svg', dark: '/brand/pampojo-icon-dark.svg' },
} as const;

export interface BrandMarkProps {
  variant: keyof typeof SOURCES;
  width: number;
  height: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}

/** The logo for the active theme; CSS picks the variant, so it is right before hydration. */
export function BrandMark({
  variant,
  width,
  height,
  alt = '',
  priority,
  className,
}: BrandMarkProps) {
  const sources = SOURCES[variant];
  return (
    <>
      <Image
        src={sources.light}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn(className, 'dark:hidden')}
      />
      <Image
        src={sources.dark}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn(className, 'hidden dark:block')}
      />
    </>
  );
}
