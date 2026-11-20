import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { render } from '@/test/render';
import { OnlineOnly } from '..';

afterEach(() => {
  vi.restoreAllMocks();
});

const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

describe('OnlineOnly (spec 17 AC4)', () => {
  it('passes the control through online', async () => {
    const onClick = vi.fn();
    const screen = await render(
      <OnlineOnly label="Create workout" kind="icon">
        <Button onClick={onClick}>+</Button>
      </OnlineOnly>,
    );
    await screen.getByRole('button', { name: 'Create workout' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('offline-badge').elements()).toHaveLength(0);
  });

  it('blocks an icon control offline with the corner badge and a toast', async () => {
    offline();
    const onClick = vi.fn();
    const screen = await render(
      <>
        <OnlineOnly label="Create workout" kind="icon">
          <Button onClick={onClick}>+</Button>
        </OnlineOnly>
        <Toaster />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Create workout. Needs internet' });
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await expect.element(button).toHaveAttribute('data-blocked', '');
    await expect.element(screen.getByTestId('offline-badge')).toBeInTheDocument();

    await button.click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });

  it('blocks a label control offline with no badge, also from the keyboard', async () => {
    offline();
    const onClick = vi.fn();
    const screen = await render(
      <>
        <OnlineOnly label="Save" kind="label">
          <Button onClick={onClick}>Save</Button>
        </OnlineOnly>
        <Toaster />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Save. Needs internet' });
    expect(screen.getByTestId('offline-badge').elements()).toHaveLength(0);
    (button.element() as HTMLElement).focus();
    (button.element() as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onClick).not.toHaveBeenCalled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });
});
