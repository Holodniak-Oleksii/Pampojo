import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { INSTALL_CARD_HIDDEN_UNTIL_KEY } from '../constants';
import { InstallCard } from '../InstallCard';
import { InstallRow } from '../InstallRow';
import { attachInstallListeners, resetInstallState } from '../install';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

function capturePrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
  window.dispatchEvent(event);
  return event;
}

let detach: () => void;
beforeEach(() => {
  resetInstallState();
  detach = attachInstallListeners();
  localStorage.removeItem(INSTALL_CARD_HIDDEN_UNTIL_KEY);
});
afterEach(() => {
  detach();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('InstallCard and InstallRow (AC4)', () => {
  it('calls the browser prompt from the card and the row', async () => {
    const event = capturePrompt();
    const screen = await render(
      <>
        <InstallCard />
        <InstallRow />
      </>,
    );
    await expect.element(screen.getByRole('heading', { name: 'Install Pampojo' })).toBeVisible();
    await screen.getByRole('button', { name: 'Install', exact: true }).click();
    await expect.poll(() => vi.mocked(event.prompt).mock.calls.length).toBe(1);

    const again = capturePrompt();
    await screen.getByRole('button', { name: 'Install app' }).click();
    await expect.poll(() => vi.mocked(again.prompt).mock.calls.length).toBe(1);
  });

  it('opens the iPhone guide on iOS', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IOS_UA);
    const screen = await render(<InstallCard />);
    await screen.getByRole('button', { name: 'How to install' }).click();
    await expect.element(screen.getByRole('dialog', { name: 'Install Pampojo' })).toBeVisible();
    await expect.element(screen.getByText('Tap "Share"')).toBeVisible();
    await expect.element(screen.getByText('Choose "Add to Home Screen"')).toBeVisible();
    await expect.element(screen.getByText('Tap "Add"')).toBeVisible();
    await screen.getByRole('button', { name: 'Got it' }).click();
    await expect
      .element(screen.getByRole('dialog', { name: 'Install Pampojo' }))
      .not.toBeInTheDocument();
  });

  it('hides the card for 7 days after closing, then shows it again', async () => {
    capturePrompt();
    let screen = await render(<InstallCard />);
    await screen.getByRole('button', { name: 'Close' }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Install Pampojo' }))
      .not.toBeInTheDocument();
    const until = Date.parse(localStorage.getItem(INSTALL_CARD_HIDDEN_UNTIL_KEY) ?? '');
    expect(Math.round((until - Date.now()) / 86_400_000)).toBe(7);

    localStorage.setItem(INSTALL_CARD_HIDDEN_UNTIL_KEY, new Date(Date.now() - 1000).toISOString());
    screen = await render(<InstallCard />);
    await expect.element(screen.getByRole('heading', { name: 'Install Pampojo' })).toBeVisible();
  });

  it('shows nothing when installed or with no install path', async () => {
    let screen = await render(
      <>
        <InstallCard />
        <InstallRow />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Install Pampojo' }).elements()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Install app' }).elements()).toHaveLength(0);

    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(display-mode: standalone)',
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    capturePrompt();
    screen = await render(<InstallRow />);
    expect(screen.getByRole('button', { name: 'Install app' }).elements()).toHaveLength(0);
  });
});
