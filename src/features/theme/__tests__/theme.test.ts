import { describe, expect, it } from 'vitest';
import { THEME_COLOR } from '../constants';
import { THEME_SCRIPT } from '../theme-script';
import { parseTheme, resolveTheme } from '../theme';

describe('parseTheme', () => {
  it('keeps the three values and reads anything else as system', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('system')).toBe('system');
    expect(parseTheme('blue')).toBe('system');
    expect(parseTheme(null)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the system only for system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('THEME_SCRIPT', () => {
  it('reads the stored key and sets the theme colour', () => {
    expect(THEME_SCRIPT).toContain('pampojo:theme');
    expect(THEME_SCRIPT).toContain(THEME_COLOR.dark);
    expect(THEME_SCRIPT.length).toBeLessThan(1024);
  });
});
