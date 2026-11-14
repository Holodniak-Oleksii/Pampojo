import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title as a heading with the description and the action', async () => {
    const screen = await render(
      <EmptyState
        icon={Dumbbell}
        title="No workouts yet"
        description="Create one first."
        action={<Link href="/library/workouts">Create workout</Link>}
      />,
    );

    await expect
      .element(screen.getByRole('heading', { level: 2, name: 'No workouts yet' }))
      .toBeVisible();
    await expect.element(screen.getByText('Create one first.')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Create workout' }))
      .toHaveAttribute('href', '/library/workouts');
  });

  it('renders only the title when nothing else is given', async () => {
    const screen = await render(<EmptyState icon={Dumbbell} title="Coming soon." />);

    await expect.element(screen.getByRole('heading', { name: 'Coming soon.' })).toBeVisible();
    await expect.element(screen.getByRole('link')).not.toBeInTheDocument();
  });

  it('draws the icon plainly, without a tinted tile', async () => {
    const screen = await render(<EmptyState icon={Dumbbell} title="Coming soon." />);

    await expect.element(screen.getByRole('heading', { name: 'Coming soon.' })).toBeVisible();
    const icon = screen.getByRole('heading').element().previousElementSibling;
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });
});
