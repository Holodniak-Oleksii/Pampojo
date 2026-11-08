import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page heading with subtitle and actions', async () => {
    const screen = await render(
      <PageHeader title="Library" subtitle="Your workouts" actions={<button>Create</button>} />,
    );

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    await expect.element(screen.getByText('Your workouts')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Create' })).toBeVisible();
  });
});
