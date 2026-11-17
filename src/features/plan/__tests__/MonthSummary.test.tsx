import { describe, expect, it } from 'vitest';
import type { RangeSummary } from '@/shared/plan/statuses';
import { render } from '@/test/render';
import { MonthSummary } from '../MonthSummary';

const summary = (override: Partial<RangeSummary> = {}): RangeSummary => ({
  onTime: 5,
  late: 1,
  missed: 2,
  planned: 3,
  extra: 0,
  due: 8,
  done: 6,
  percent: 75,
  dueRow: ['on_time', 'on_time', 'late', 'missed', 'on_time', 'on_time', 'missed', 'on_time'],
  ...override,
});

describe('MonthSummary', () => {
  it('shows the percent, one diamond per due workout and each count with its label', async () => {
    const screen = await render(
      <MonthSummary summary={summary()} variant="counts" headingId="s" />,
    );
    await expect.element(screen.getByText('75%')).toBeVisible();
    // Test runs have no Tailwind, so the diamonds have no size: check the row, not its pixels.
    const row = screen.getByRole('img', { name: '6 of 8 planned workouts done' });
    await expect.element(row).toBeInTheDocument();
    expect(row.element().children).toHaveLength(8);
    for (const label of ['5 on time', '1 late', '2 missed', '3 planned']) {
      await expect.element(screen.getByRole('listitem').filter({ hasText: label })).toBeVisible();
    }
    expect(screen.getByRole('listitem').filter({ hasText: 'extra' }).elements()).toHaveLength(0);
  });

  it('shows a dash and no row when nothing was due', async () => {
    const screen = await render(
      <MonthSummary
        summary={summary({
          due: 0,
          done: 0,
          percent: null,
          dueRow: [],
          onTime: 0,
          late: 0,
          missed: 0,
        })}
        variant="sentence"
        monthLabel="in November"
        headingId="s"
      />,
    );
    await expect.element(screen.getByText('—')).toBeVisible();
    expect(screen.getByRole('img').elements()).toHaveLength(0);
    await expect.element(screen.getByText('No planned workouts in November yet.')).toBeVisible();
  });

  it('says the month in one sentence on Today', async () => {
    const screen = await render(
      <MonthSummary
        summary={summary()}
        variant="sentence"
        monthLabel="in November"
        headingId="s"
      />,
    );
    await expect
      .element(
        screen.getByText('6 of 8 planned workouts in November: 5 on time, 1 late, 2 missed.'),
      )
      .toBeVisible();
  });
});
