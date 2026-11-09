import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/api/auth';
import { render } from '@/test/render';
import { AuthCard } from '../AuthCard';

vi.mock('@/api/auth', () => ({
  authClient: { signIn: { email: vi.fn(), social: vi.fn() }, signUp: { email: vi.fn() } },
}));

describe('AuthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the log-in copy and tabs that keep next', async () => {
    const screen = await render(<AuthCard mode="login" next="/today" googleEnabled />);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Welcome back' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Log in' }))
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(screen.getByRole('link', { name: 'Sign up' }))
      .toHaveAttribute('href', '/signup?next=%2Ftoday');
    await expect
      .element(screen.getByRole('button', { name: 'Continue with Google' }))
      .toBeVisible();
  });

  it('hides Google when it is not enabled', async () => {
    const screen = await render(<AuthCard mode="signup" next={null} googleEnabled={false} />);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Create your account' }))
      .toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue with Google' }).elements()).toHaveLength(0);
  });

  it('shows the Google conflict error from the callback', async () => {
    const screen = await render(
      <AuthCard mode="login" next={null} googleEnabled initialError="account_not_linked" />,
    );

    await expect
      .element(
        screen.getByText('This email is registered with a password. Log in with your password.'),
      )
      .toBeVisible();
  });

  it('shows the rate-limit message from a 429', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: { status: 429 },
    } as never);
    const screen = await render(<AuthCard mode="login" next={null} googleEnabled={false} />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');
    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect
      .element(screen.getByText('Too many attempts. Try again in a minute.'))
      .toBeVisible();
  });

  it('shows the duplicate-account message from sign-up', async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValueOnce({
      data: null,
      error: { status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
    } as never);
    const screen = await render(<AuthCard mode="signup" next={null} googleEnabled={false} />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');
    await screen.getByRole('button', { name: 'Create account' }).click();

    await expect
      .element(screen.getByText('An account with this email already exists. Log in instead.'))
      .toBeVisible();
  });

  it('disables Google while the email sign-in is pending', async () => {
    vi.mocked(authClient.signIn.email).mockImplementation(() => new Promise(() => {}));
    const screen = await render(<AuthCard mode="login" next={null} googleEnabled />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');
    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect.element(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Continue with Google' }))
      .toBeDisabled();
  });

  it('disables the email form while the Google redirect is pending', async () => {
    vi.mocked(authClient.signIn.social).mockImplementation(() => new Promise(() => {}));
    const screen = await render(<AuthCard mode="signup" next={null} googleEnabled />);

    await screen.getByRole('button', { name: 'Continue with Google' }).click();

    await expect
      .element(screen.getByRole('button', { name: 'Continue with Google' }))
      .toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('shows the generic error after a network failure and clears it on the next attempt', async () => {
    vi.mocked(authClient.signIn.email)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementationOnce(() => new Promise(() => {}));
    const screen = await render(<AuthCard mode="login" next={null} googleEnabled={false} />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');
    await screen.getByRole('button', { name: 'Log in' }).click();

    const alert = screen.getByText('Something went wrong. Try again.');
    await expect.element(alert).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();

    await screen.getByRole('button', { name: 'Log in' }).click();
    await expect.element(screen.getByRole('button', { name: 'Logging in…' })).toBeVisible();
    await expect.element(alert).not.toBeInTheDocument();
  });

  it('re-enables Google and shows the generic error when it cannot start', async () => {
    vi.mocked(authClient.signIn.social).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const screen = await render(<AuthCard mode="login" next={null} googleEnabled />);

    await screen.getByRole('button', { name: 'Continue with Google' }).click();

    await expect.element(screen.getByText('Something went wrong. Try again.')).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Continue with Google' }))
      .toBeEnabled();
  });

  it('disables the form and Google while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    const screen = await render(<AuthCard mode="login" next={null} googleEnabled />);

    await expect
      .element(screen.getByText("You're offline. Connect to the internet to log in."))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Continue with Google' }))
      .toBeDisabled();
  });
});
