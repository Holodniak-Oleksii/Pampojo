import type { ValueOf } from '@/types/utils';

export const THEME = { SYSTEM: 'system', LIGHT: 'light', DARK: 'dark' } as const;

export type Theme = ValueOf<typeof THEME>;
export type ResolvedTheme = typeof THEME.LIGHT | typeof THEME.DARK;

export const THEMES: readonly Theme[] = Object.values(THEME);

export const THEME_STORAGE_KEY = 'pampojo:theme';

/** Browser UI colour per theme: the page background. A meta tag cannot read CSS tokens. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  // eslint-disable-next-line no-restricted-syntax -- mirrors --background for <meta name="theme-color">
  light: '#ECE9E4',
  // eslint-disable-next-line no-restricted-syntax -- mirrors --background in .dark
  dark: '#1E1C1A',
};

export const DARK_QUERY = '(prefers-color-scheme: dark)';
