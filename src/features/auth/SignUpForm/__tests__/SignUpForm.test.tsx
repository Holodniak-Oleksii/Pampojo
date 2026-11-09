import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { authClient } from '@/api/auth';
import { render } from '@/test/render';
import { SignUpForm } from '../SignUpForm';

vi.mock('@/api/auth', () => ({
  authClient: { signIn: { email: vi.fn(), social: vi.fn() }, signUp: { email: vi.fn() } },
}));

const signUp = vi.mocked(authClient.signUp.email);

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the 8-character minimum on submit, without a hint before it', async () => {
    const screen = await render(<SignUpForm next={null} disabled={false} onError={vi.fn()} />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('short');
    await userEvent.tab();
    expect(screen.getByText(/8 characters/).elements()).toHaveLength(0);

    await screen.getByRole('button', { name: 'Create account' }).click();

    await expect.element(screen.getByText('Password must be at least 8 characters')).toBeVisible();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the value becomes valid', async () => {
    const screen = await render(<SignUpForm next={null} disabled={false} onError={vi.fn()} />);

    await screen.getByLabelText('Email').fill('john@example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('short');
    await screen.getByRole('button', { name: 'Create account' }).click();
    const error = screen.getByText('Password must be at least 8 characters');
    await expect.element(error).toBeVisible();

    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');

    await expect.element(error).not.toBeInTheDocument();
  });

  it('sends the email local part as the placeholder name', async () => {
    signUp.mockImplementation(() => new Promise(() => {}));
    const screen = await render(<SignUpForm next={null} disabled={false} onError={vi.fn()} />);

    await screen.getByLabelText('Email').fill('John.Smith@Example.com');
    await screen.getByLabelText('Password', { exact: true }).fill('Password123!');
    await screen.getByRole('button', { name: 'Create account' }).click();

    await expect.element(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
    expect(signUp).toHaveBeenCalledWith({
      email: 'john.smith@example.com',
      password: 'Password123!',
      name: 'john.smith',
    });
  });

  it('links the terms and privacy pages', async () => {
    const screen = await render(<SignUpForm next={null} disabled={false} onError={vi.fn()} />);

    await expect
      .element(screen.getByRole('link', { name: 'Terms' }))
      .toHaveAttribute('href', '/terms');
    await expect
      .element(screen.getByRole('link', { name: 'Privacy policy' }))
      .toHaveAttribute('href', '/privacy');
  });
});
