import { describe, expect, it } from 'vitest';
import { localSession } from '@/test/local-session';
import { render } from '@/test/render';
import { SessionBar } from '..';

describe('SessionBar (AC17)', () => {
  it('shows the rest left and links back to the session', async () => {
    const session = localSession({
      restEndsAt: new Date(Date.now() + 48_500).toISOString(),
      restDurationSec: 90,
    });
    const screen = await render(<SessionBar inProgress={{ session, setLogs: [] }} />);
    const link = screen.getByRole('link', { name: 'Back to workout Push Day' });
    await expect.element(link).toHaveAttribute('href', `/session/${session.id}`);
    await expect.element(screen.getByText('Rest 0:49')).toBeVisible();
  });

  it('shows the elapsed time when no rest runs', async () => {
    const session = localSession({
      startedAt: new Date(Date.now() - (24 * 60 + 17) * 1000).toISOString(),
    });
    const screen = await render(<SessionBar inProgress={{ session, setLogs: [] }} />);
    await expect.element(screen.getByText(/^0:24:1[78]$/)).toBeVisible();
  });
});
