'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { THEME, THEMES, type Theme } from '../constants';
import { useTheme } from '../useTheme';

const ICONS: Record<Theme, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export interface ThemeSwitchProps {
  /** `labels` for the Profile row, `icons` for the compact landing footer. */
  variant: 'labels' | 'icons';
  className?: string;
}

export function ThemeSwitch({ variant, className }: ThemeSwitchProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const labels: Record<Theme, string> = {
    [THEME.SYSTEM]: t('System'),
    [THEME.LIGHT]: t('Light'),
    [THEME.DARK]: t('Dark'),
  };

  // A radio group: arrows move the choice and the focus together.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = (THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length;
    const next = THEMES[index] ?? THEME.SYSTEM;
    setTheme(next);
    buttons.current[index]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('Theme')}
      className={cn(
        'gap-1 rounded-md bg-background p-1',
        variant === 'labels' ? 'grid grid-cols-3' : 'inline-flex',
        className,
      )}
    >
      {THEMES.map((option, index) => {
        const Icon = ICONS[option];
        const selected = option === theme;
        return (
          <button
            key={option}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={variant === 'icons' ? labels[option] : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTheme(option)}
            onKeyDown={onKeyDown}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-sm text-sm leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring',
              variant === 'labels' ? 'min-h-11 px-2 py-1 font-semibold' : 'size-11',
              selected
                ? 'bg-card font-bold text-foreground ring-1 ring-border-strong'
                : 'text-muted-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {variant === 'labels' ? labels[option] : null}
          </button>
        );
      })}
    </div>
  );
}
