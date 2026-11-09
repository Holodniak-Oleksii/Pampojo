import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { authClient } from '@/api/auth';
import { render } from '@/test/render';
import { LogInForm } from '../LogInForm';

vi.mock('@/api/auth', () => ({
  authClient: { signIn: { email: vi.fn(), social: vi.fn() }, signUp: { email: vi.fn() } },
}));

const signIn = vi.mocked(authClient.signIn.email);

async function fill(screen: Awaited<ReturnType<typeof render>>, email: string, password: string) {
  await screen.getByLabelText('Email').fill(email);
  await screen.getByLabelText('Password', { exact: true }).fill(password);
}

describe('LogInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the email error only after submit', async () => {
    const screen = await render(<LogInForm next={null} disabled={false} onError={vi.fn()} />);

    await screen.getByLabelText('Email').fill('not-an-email');
    await userEvent.tab();
    expect(screen.getByText('Enter a valid email').elements()).toHaveLength(0);

    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect.element(screen.getByText('Enter a valid email')).toBeVisible();
    await expect
      .element(screen.getByLabelText('Email'))
      .toHaveAttribute('aria-describedby', 'login-email-error');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects a password over 128 characters', async () => {
    const screen = await render(<LogInForm next={null} disabled={false} onError={vi.fn()} />);

    await fill(screen, 'john@example.com', 'x'.repeat(129));
    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect.element(screen.getByText('Password must be at most 128 characters')).toBeVisible();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('disables submit while pending and sends one request on a double click', async () => {
    signIn.mockImplementation(() => new Promise(() => {}));
    const screen = await render(<LogInForm next={null} disabled={false} onError={vi.fn()} />);

    await fill(screen, 'john@example.com', 'Password123!');
    const submit = screen.getByRole('button', { name: 'Log in' });
    await submit.dblClick();

    await expect.element(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith({ email: 'john@example.com', password: 'Password123!' });
  });

  it('reports wrong credentials and rate limiting to the card', async () => {
    const onError = vi.fn();
    signIn.mockResolvedValueOnce({
      data: null,
      error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' },
    } as never);
    const screen = await render(<LogInForm next={null} disabled={false} onError={onError} />);

    await fill(screen, 'john@example.com', 'wrong-pass');
    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect
      .poll(() => onError)
      .toHaveBeenCalledWith({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' });
    await expect.element(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('recovers from a network failure', async () => {
    const onError = vi.fn();
    const onPendingChange = vi.fn();
    signIn.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const screen = await render(
      <LogInForm
        next={null}
        disabled={false}
        onError={onError}
        onPendingChange={onPendingChange}
      />,
    );

    await fill(screen, 'john@example.com', 'Password123!');
    await screen.getByRole('button', { name: 'Log in' }).click();

    await expect.poll(() => onError).toHaveBeenCalledWith({});
    await expect.element(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('shows a placeholder in the password field', async () => {
    const screen = await render(<LogInForm next={null} disabled={false} onError={vi.fn()} />);

    await expect
      .element(screen.getByLabelText('Password', { exact: true }))
      .toHaveAttribute('placeholder', '••••••••');
  });

  it('is disabled when the card says so', async () => {
    const screen = await render(<LogInForm next={null} disabled onError={vi.fn()} />);

    await expect.element(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
  });
});
