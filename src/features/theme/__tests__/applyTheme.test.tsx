import { afterEach, describe, expect, it } from 'vitest';
import { THEME_COLOR } from '../constants';
import { applyTheme } from '../theme';

afterEach(() => {
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.style.colorScheme = '';
});

describe('applyTheme (AC8)', () => {
  it('sets the class, the colour scheme and the browser theme colour', () => {
    applyTheme('dark');
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      THEME_COLOR.dark,
    );
    applyTheme('light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('light')).toBe(true);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      THEME_COLOR.light,
    );
  });
});
