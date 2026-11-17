import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { StatusMarker, type MarkerStatus } from '../StatusMarker';

describe('StatusMarker', () => {
  it('fills done markers and outlines the others', async () => {
    const statuses: MarkerStatus[] = ['on_time', 'late', 'missed', 'planned', 'extra'];
    const screen = await render(
      <div>
        {statuses.map((status) => (
          <span key={status} data-testid={status}>
            <StatusMarker status={status} />
          </span>
        ))}
      </div>,
    );
    const variant = (status: string) =>
      screen.getByTestId(status).element().firstElementChild?.getAttribute('data-variant');
    expect(statuses.map(variant)).toEqual(['fill', 'outline', 'outline', 'outline', 'fill']);
  });
});
