import { cn } from '@/lib/utils';
import { BRAND_ASSETS } from '../brand-assets';

/** The home-screen icon itself, so the install UI shows what the user will get. */
export function AppIconTile({ size, className }: { size: 32 | 40; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the brand SVG is precached for offline; next/image is not.
    <img
      src={BRAND_ASSETS.icon}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn(
        'shrink-0 shadow-[0_3px_8px_var(--shadow-color)]',
        size === 40 ? 'rounded-[10px]' : 'rounded-lg',
        className,
      )}
    />
  );
}
