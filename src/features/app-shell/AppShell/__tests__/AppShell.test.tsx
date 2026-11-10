import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { usePathname } from 'next/navigation';
import { render } from '@/test/render';
import { AppShell } from '../AppShell';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

const MAIN_NAV = { name: 'Main navigation' } as const;

// Browser tests load no CSS, so both navigations are in the DOM: the sidebar inside the
// complementary landmark, the bottom bar as the last "Main navigation".
const renderShell = (pathname: string) => {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(
    <AppShell>
      <h1>Page content</h1>
    </AppShell>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell', () => {
  it('renders the page inside main', async () => {
    const screen = await renderShell('/calendar');

    await expect
      .element(screen.getByRole('main').getByRole('heading', { name: 'Page content' }))
      .toBeInTheDocument();
  });

  it('bottom bar: four icon-only section links around Start, no Today', async () => {
    const screen = await renderShell('/calendar');

    const links = screen.getByRole('navigation', MAIN_NAV).last().getByRole('link').elements();
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Calendar',
      'Library',
      'Progress',
      'Profile',
    ]);
    for (const link of links) expect(link.textContent).toBe('');
    await expect
      .element(
        screen
          .getByRole('navigation', MAIN_NAV)
          .last()
          .getByRole('button', { name: 'Start workout' }),
      )
      .toBeInTheDocument();
  });

  it('sidebar: Today first, then the sections', async () => {
    const screen = await renderShell('/calendar');

    const links = screen
      .getByRole('complementary')
      .getByRole('navigation', MAIN_NAV)
      .getByRole('link')
      .elements();
    expect(links.map((link) => link.textContent)).toEqual([
      'Today',
      'Calendar',
      'Library',
      'Progress',
      'Profile',
    ]);
  });

  it('marks Library current on a library sub-route in both navigations', async () => {
    const screen = await renderShell('/library/exercises');

    for (const index of [0, 1]) {
      await expect
        .element(
          screen
            .getByRole('navigation', MAIN_NAV)
            .nth(index)
            .getByRole('link', { name: 'Library' }),
        )
        .toHaveAttribute('aria-current', 'page');
      for (const name of ['Calendar', 'Progress', 'Profile']) {
        await expect
          .element(screen.getByRole('navigation', MAIN_NAV).nth(index).getByRole('link', { name }))
          .not.toHaveAttribute('aria-current');
      }
    }
  });

  it('on /today marks only the sidebar Today link current', async () => {
    const screen = await renderShell('/today');

    await expect
      .element(
        screen
          .getByRole('complementary')
          .getByRole('navigation', MAIN_NAV)
          .getByRole('link', { name: 'Today' }),
      )
      .toHaveAttribute('aria-current', 'page');
    for (const name of ['Calendar', 'Library', 'Progress', 'Profile']) {
      await expect
        .element(screen.getByRole('navigation', MAIN_NAV).last().getByRole('link', { name }))
        .not.toHaveAttribute('aria-current');
    }
  });

  it('marks Profile current on a profile sub-route', async () => {
    const screen = await renderShell('/profile/gym');

    await expect
      .element(
        screen
          .getByRole('complementary')
          .getByRole('navigation', MAIN_NAV)
          .getByRole('link', { name: 'Profile' }),
      )
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(
        screen
          .getByRole('complementary')
          .getByRole('navigation', MAIN_NAV)
          .getByRole('link', { name: 'Today' }),
      )
      .not.toHaveAttribute('aria-current');
  });

  it('links the top bar icon and the sidebar wordmark to Today and titles the section', async () => {
    const screen = await renderShell('/progress');

    const links = screen.getByRole('link', { name: 'Pampojo, Today' }).elements();
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('/today');
    await expect
      .element(screen.getByRole('banner').getByText('Progress', { exact: true }))
      .toBeInTheDocument();
  });

  it('opens Choose workout from the bottom bar and returns focus to Start on Escape', async () => {
    const screen = await renderShell('/calendar');
    const start = screen
      .getByRole('navigation', MAIN_NAV)
      .last()
      .getByRole('button', { name: 'Start workout' });

    await start.click();
    await expect.element(screen.getByRole('dialog', { name: 'Choose workout' })).toBeVisible();
    await expect
      .element(screen.getByRole('dialog').getByRole('heading', { name: 'No workouts yet' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('dialog').getByText('Create a workout to start a session.'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('dialog').getByRole('link', { name: 'Create workout' }))
      .toHaveAttribute('href', '/library/workouts');

    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(start).toHaveFocus();
  });

  it('opens Choose workout from the sidebar and closes it on Create workout', async () => {
    const screen = await renderShell('/progress');

    await screen.getByRole('complementary').getByRole('button', { name: 'Start workout' }).click();
    const link = screen.getByRole('dialog').getByRole('link', { name: 'Create workout' });
    // Keep the test page in place; only the sheet's own reaction is under test.
    link.element().addEventListener('click', (event) => event.preventDefault(), { once: true });
    await link.click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches the status pill with the connection', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const screen = await renderShell('/today');

    await expect.element(screen.getByRole('status')).toHaveTextContent('Online');
    online.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await expect.element(screen.getByRole('status')).toHaveTextContent('Offline');
    online.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await expect.element(screen.getByRole('status')).toHaveTextContent('Online');
  });
});
