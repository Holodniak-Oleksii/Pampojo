import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders label, value, unit and trend', async () => {
    const screen = await render(
      <StatCard
        label="BMI"
        value="24.8"
        unit="kg/m²"
        trend={{ direction: 'down', text: '-0.6' }}
      />,
    );

    await expect.element(screen.getByText('BMI')).toBeVisible();
    await expect.element(screen.getByText('24.8')).toBeVisible();
    await expect.element(screen.getByText('kg/m²')).toBeVisible();
    await expect.element(screen.getByText('-0.6')).toBeVisible();
  });

  it('renders children', async () => {
    const screen = await render(
      <StatCard label="Workouts this month" value="12">
        <p>Chart</p>
      </StatCard>,
    );

    await expect.element(screen.getByText('Chart')).toBeVisible();
  });
});
