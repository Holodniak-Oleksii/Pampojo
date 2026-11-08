'use client';

import { cn } from '@/lib/utils';
import { AVATAR_EMOJI, type AvatarColor, type AvatarEmojiId } from '@/constants/avatar';
import { useAvatarEmojiNames } from './useAvatarEmojiNames';

// Static class names, so Tailwind sees every token it has to generate.
const COLOR_CLASS: Record<AvatarColor, string> = {
  1: 'bg-avatar-1',
  2: 'bg-avatar-2',
  3: 'bg-avatar-3',
  4: 'bg-avatar-4',
  5: 'bg-avatar-5',
  6: 'bg-avatar-6',
  7: 'bg-avatar-7',
  8: 'bg-avatar-8',
};

const SIZE_CLASS = {
  sm: 'size-8 text-lg',
  md: 'size-12 text-[26px]',
  lg: 'size-20 text-[44px]',
} as const;

export interface EmojiAvatarProps {
  emoji: AvatarEmojiId;
  color: AvatarColor;
  size?: keyof typeof SIZE_CLASS;
  label?: string;
  className?: string;
}

export function EmojiAvatar({ emoji, color, size = 'md', label, className }: EmojiAvatarProps) {
  const names = useAvatarEmojiNames();
  return (
    <span
      role="img"
      aria-label={label ?? names[emoji]}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full leading-none select-none',
        COLOR_CLASS[color],
        SIZE_CLASS[size],
        className,
      )}
    >
      <span aria-hidden="true">{AVATAR_EMOJI[emoji]}</span>
    </span>
  );
}
