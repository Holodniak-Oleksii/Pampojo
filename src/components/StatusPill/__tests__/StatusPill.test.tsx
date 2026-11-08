import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it('shows Online', async () => {
    const screen = await render(<StatusPill status="online" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent('Online');
  });

  it('shows Offline', async () => {
    const screen = await render(<StatusPill status="offline" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent('Offline');
  });

  it('shows the pending count and a full sentence for screen readers', async () => {
    const screen = await render(<StatusPill status="offline" pendingCount={3} />);

    await expect.element(screen.getByText('· 3 pending')).toBeVisible();
    await expect.element(screen.getByText('3 changes waiting to sync')).toBeInTheDocument();
  });

  it.each([
    [1, '1 зміна чекає синхронізації'],
    [3, '3 зміни чекають синхронізації'],
    [5, '5 змін чекають синхронізації'],
  ])('uses the Ukrainian plural form for %i', async (count, sentence) => {
    const screen = await render(<StatusPill status="offline" pendingCount={count} />, {
      locale: 'uk',
    });

    await expect.element(screen.getByText('Офлайн', { exact: true })).toBeVisible();
    await expect.element(screen.getByText(`· ${count} в черзі`)).toBeVisible();
    await expect.element(screen.getByText(sentence)).toBeInTheDocument();
  });
});
