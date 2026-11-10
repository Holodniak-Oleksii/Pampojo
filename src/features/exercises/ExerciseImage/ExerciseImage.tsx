'use client';

import { Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ExerciseImageProps {
  src: string | null;
  /** Extra sizes as `url width` pairs; the browser picks one using `sizes`. */
  srcSet?: string;
  sizes?: string;
  /** Exercise name: the placeholder text, and the alt text when `alt` is not given. */
  name: string;
  alt?: string;
  /** Below `lg` the tile is too small for the name, so it shows an icon instead. */
  compact?: boolean;
  className?: string;
}

/** An exercise photo, or a tile with the name when there is no image or it fails to load. */
export function ExerciseImage({
  src,
  srcSet,
  sizes,
  name,
  alt,
  compact,
  className,
}: ExerciseImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = src === null || failedSrc === src;

  return (
    <div className={cn('relative overflow-hidden bg-accent-soft', className)}>
      {broken ? (
        <span
          role="img"
          aria-label={alt === '' ? undefined : (alt ?? name)}
          aria-hidden={alt === '' ? true : undefined}
          className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs leading-tight font-semibold text-foreground/70"
        >
          {compact ? <Dumbbell aria-hidden="true" className="size-6 lg:hidden" /> : null}
          <span className={cn('line-clamp-3', compact && 'hidden lg:inline')}>{name}</span>
        </span>
      ) : (
        // A plain img: the WebP files are already resized in Storage and `srcset` picks the size,
        // which next/image cannot do without its optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt ?? name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  );
}
