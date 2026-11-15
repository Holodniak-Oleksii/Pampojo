import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from '@/test/render';
import { ThemeSwitch } from '..';

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  root().classList.remove('dark', 'light');
});

describe('ThemeSwitch (AC2)', () => {
  it('shows the three options with System selected by default', async () => {
    const screen = await render(<ThemeSwitch variant="labels" />);
    await expect.element(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    await expect
      .element(screen.getByRole('radio', { name: 'System' }))
      .toHaveAttribute('aria-checked', 'true');
    await expect
      .element(screen.getByRole('radio', { name: 'Light' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('stores and applies a choice at once', async () => {
    const screen = await render(<ThemeSwitch variant="labels" />);
    await screen.getByRole('radio', { name: 'Dark' }).click();
    expect(localStorage.getItem('pampojo:theme')).toBe('dark');
    expect(root().classList.contains('dark')).toBe(true);
    await screen.getByRole('radio', { name: 'Light' }).click();
    expect(localStorage.getItem('pampojo:theme')).toBe('light');
    expect(root().classList.contains('dark')).toBe(false);
    await expect
      .element(screen.getByRole('radio', { name: 'Light' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('moves the choice with the arrow keys', async () => {
    const screen = await render(<ThemeSwitch variant="icons" />);
    await screen.getByRole('radio', { name: 'System' }).click();
    await userEvent.keyboard('{ArrowRight}');
    await expect
      .element(screen.getByRole('radio', { name: 'Light' }))
      .toHaveAttribute('aria-checked', 'true');
    await expect.element(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect
      .element(screen.getByRole('radio', { name: 'Dark' }))
      .toHaveAttribute('aria-checked', 'true');
  });
});
