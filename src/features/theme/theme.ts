import { THEME, THEME_COLOR, THEMES, type ResolvedTheme, type Theme } from './constants';

export function parseTheme(value: unknown): Theme {
  return THEMES.find((theme) => theme === value) ?? THEME.SYSTEM;
}

export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === THEME.SYSTEM) return systemDark ? THEME.DARK : THEME.LIGHT;
  return theme;
}

/** Puts the theme on <html> and the browser UI; the inline script does the same before hydration. */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle(THEME.DARK, resolved === THEME.DARK);
  root.classList.toggle(THEME.LIGHT, resolved === THEME.LIGHT);
  root.style.colorScheme = resolved;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[resolved];
}
