import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it('shows Online on a light pill', async () => {
    const screen = await render(<StatusPill status="online" />);

    const pill = screen.getByRole('status');
    await expect.element(pill).toHaveTextContent('Online');
    await expect.element(pill).toHaveClass('bg-card');
  });

  it('shows Offline on a dark pill', async () => {
    const screen = await render(<StatusPill status="offline" />);

    const pill = screen.getByRole('status');
    await expect.element(pill).toHaveTextContent('Offline');
    await expect.element(pill).toHaveClass('bg-foreground');
    await expect.element(screen.getByTestId('pending-badge')).not.toBeInTheDocument();
  });

  it('shows the pending count as a badge and a full sentence for screen readers', async () => {
    const screen = await render(<StatusPill status="offline" pendingCount={3} />);

    await expect.element(screen.getByTestId('pending-badge')).toHaveTextContent('3');
    await expect.element(screen.getByText('3 changes waiting to sync')).toBeInTheDocument();
    expect(screen.getByRole('status').element().textContent).not.toContain('·');
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
    await expect.element(screen.getByText(sentence)).toBeInTheDocument();
  });
});
