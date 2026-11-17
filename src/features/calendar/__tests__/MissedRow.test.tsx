import { describe, expect, it, vi } from 'vitest';
import type { CalendarOccurrence } from '@/shared/plan/statuses';
import { render } from '@/test/render';
import { MissedRow } from '../MissedRow';

const occurrence = (lateWindowEnd: string | null): CalendarOccurrence => ({
  ruleId: '00000000-0000-4000-8000-00000000b001',
  workoutId: '00000000-0000-4000-8000-00000000a001',
  workoutName: 'Push Day',
  status: 'missed',
  sessionId: null,
  lateWindowEnd,
});

describe('MissedRow', () => {
  it('offers to make up while the window includes today', async () => {
    const onMakeUp = vi.fn();
    const screen = await render(
      <MissedRow
        occurrence={occurrence('2026-11-18')}
        thumbnailUrl={null}
        today="2026-11-17"
        starting={false}
        onMakeUp={onMakeUp}
      />,
    );
    await expect
      .element(screen.getByText('You can make it up until Wednesday, November 18.'))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Make up' }).click();
    expect(onMakeUp).toHaveBeenCalledOnce();
  });

  it('shows only the status after the window', async () => {
    const screen = await render(
      <MissedRow
        occurrence={occurrence('2026-11-16')}
        thumbnailUrl={null}
        today="2026-11-17"
        starting={false}
        onMakeUp={vi.fn()}
      />,
    );
    await expect.element(screen.getByText('Missed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Make up' }).elements()).toHaveLength(0);
  });
});
