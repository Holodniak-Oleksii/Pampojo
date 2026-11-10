import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { TodayView } from '../TodayView';

const PROPS = { displayName: 'John Smith', avatarEmoji: 'fox', avatarColor: 1 } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe('TodayView', () => {
  it('greets by the morning clock with the avatar and the empty state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    const screen = await render(<TodayView {...PROPS} />);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Good morning, John Smith' }))
      .toBeVisible();
    await expect.element(screen.getByRole('img', { name: 'Fox' })).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'No workouts yet' })).toBeVisible();
    await expect
      .element(screen.getByText('Create your first workout to start training.'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Create your first workout' }))
      .toHaveAttribute('href', '/library/workouts');
  });

  it('greets in the afternoon', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 1, 14, 0));
    const screen = await render(<TodayView {...PROPS} />);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Good afternoon, John Smith' }))
      .toBeVisible();
  });

  it('greets in Ukrainian in the evening', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 1, 20, 0));
    const screen = await render(<TodayView {...PROPS} />, { locale: 'uk' });

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Доброго вечора, John Smith' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Створити перше тренування' }))
      .toBeVisible();
  });
});
