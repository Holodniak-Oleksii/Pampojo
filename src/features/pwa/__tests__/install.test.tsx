import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachInstallListeners,
  getInstallState,
  installPath,
  promptInstall,
  resetInstallState,
} from '../install';

function promptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return event;
}

let detach: () => void;
beforeEach(() => {
  resetInstallState();
  detach = attachInstallListeners();
});
afterEach(() => {
  detach();
  vi.restoreAllMocks();
});

describe('install store (AC4)', () => {
  it('keeps the prompt event and offers the prompt path', () => {
    const event = promptEvent('accepted');
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(installPath()).toBe('prompt');
  });

  it('hides all install UI after an accepted prompt or appinstalled', async () => {
    window.dispatchEvent(promptEvent('accepted'));
    await promptInstall();
    expect(getInstallState().installed).toBe(true);
    expect(installPath()).toBeNull();

    resetInstallState();
    window.dispatchEvent(promptEvent('accepted'));
    window.dispatchEvent(new Event('appinstalled'));
    expect(installPath()).toBeNull();
  });

  it('offers the guide on iOS and nothing elsewhere', () => {
    expect(installPath()).toBeNull();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    );
    expect(installPath()).toBe('ios');
  });

  it('offers nothing when running standalone', () => {
    window.dispatchEvent(promptEvent('accepted'));
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: query === '(display-mode: standalone)' }) as MediaQueryList,
    );
    expect(installPath()).toBeNull();
  });
});
