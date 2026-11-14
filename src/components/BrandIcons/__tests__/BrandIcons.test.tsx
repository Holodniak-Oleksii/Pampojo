import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { MyGymIcon, RecordIcon, RestIcon, SetDoneIcon, WorkoutIcon } from '..';

const icons = [
  ['WorkoutIcon', WorkoutIcon],
  ['SetDoneIcon', SetDoneIcon],
  ['RecordIcon', RecordIcon],
  ['RestIcon', RestIcon],
  ['MyGymIcon', MyGymIcon],
] as const;

describe('BrandIcons', () => {
  it.each(icons)('%s is decorative by default and named with a title', async (_, Icon) => {
    const screen = await render(
      <div data-testid="icons">
        <Icon className="size-8" />
        <Icon title="Named icon" />
      </div>,
    );
    await expect.element(screen.getByRole('img', { name: 'Named icon' })).toBeInTheDocument();
    expect(screen.getByRole('img').elements()).toHaveLength(1);
    const svg = screen.getByTestId('icons').element().querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('fills the set diamond with the accent only when done', async () => {
    const screen = await render(
      <div>
        <SetDoneIcon title="Done" done />
        <SetDoneIcon title="Pending" />
      </div>,
    );
    const done = screen.getByRole('img', { name: 'Done' }).element().querySelector('path');
    const pending = screen.getByRole('img', { name: 'Pending' }).element().querySelector('path');
    expect(done?.getAttribute('fill')).toBe('var(--accent)');
    expect(pending?.getAttribute('fill')).toBe('none');
  });
});
