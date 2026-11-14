import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { updateProfile } from '@/api/profile';
import { Toaster } from '@/components/ui/sonner';
import { getGymMock, getProfileMock } from '@/test/mocks';
import { render } from '@/test/render';
import { ProfileView } from '../ProfileView';

vi.mock('@/api/profile', async () => {
  const { useMutation, useQuery, useQueryClient } = await import('@tanstack/react-query');
  const updateProfile = vi.fn();
  const fetchProfile = vi.fn();
  return {
    updateProfile,
    fetchProfile,
    useProfileQuery: ({ initialData }: { initialData: unknown }) =>
      useQuery({ queryKey: ['profile', 'me'], queryFn: fetchProfile, initialData }),
    useUpdateProfileMutation: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => client.setQueryData(['profile', 'me'], data),
      });
    },
  };
});

vi.mock('@/api/gym', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  const fetchGym = vi.fn(() => new Promise(() => {}));
  return {
    fetchGym,
    useGymQuery: ({ initialData }: { initialData?: unknown } = {}) =>
      useQuery({ queryKey: ['gym', 'me'], queryFn: fetchGym, initialData }),
  };
});

vi.mock('@/api/auth', () => ({ authClient: { signOut: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProfileView', () => {
  it('shows the gym nudge and "Not set up" before the first save', async () => {
    const screen = await render(
      <ProfileView initialGym={null} initialProfile={getProfileMock()} />,
    );
    await expect.element(screen.getByRole('heading', { name: 'Set up your gym' })).toBeVisible();
    await expect.element(screen.getByText('Not set up')).toBeVisible();
  });

  it('shows the gym count and no nudge after the first save', async () => {
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );
    await expect.element(screen.getByText('2 of 38')).toBeVisible();
    await expect.element(screen.getByText('Set up your gym')).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: /Gym equipment/ }))
      .toHaveAttribute('href', '/profile/gym');
  });

  it('shows avatar, name, age, height and latest weight', async () => {
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock({ age: 36 })} />,
    );

    await expect.element(screen.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect.element(screen.getByText('John Smith')).toBeVisible();
    await expect.element(screen.getByRole('img', { name: 'Fox' })).toBeVisible();
    await expect.element(screen.getByText('36 years')).toBeVisible();
    await expect.element(screen.getByText('180 cm')).toBeVisible();
    await expect.element(screen.getByText('79.8 kg')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  it('shows a Language row with the switcher', async () => {
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );

    await expect.element(screen.getByText('Language', { exact: true })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Language: English' })).toBeVisible();
  });

  it('shows imperial values for an imperial profile', async () => {
    const screen = await render(
      <ProfileView
        initialGym={getGymMock()}
        initialProfile={getProfileMock({ unitSystem: 'imperial', age: 1 })}
      />,
    );

    await expect.element(screen.getByText('5′11″')).toBeVisible();
    await expect.element(screen.getByText('175.9 lb')).toBeVisible();
    await expect.element(screen.getByText('1 year')).toBeVisible();
  });

  it('pluralizes the age in Ukrainian', async () => {
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock({ age: 22 })} />,
      {
        locale: 'uk',
      },
    );

    await expect.element(screen.getByText('22 роки')).toBeVisible();
  });
});

describe('EditProfileSheet', () => {
  it('keeps Save disabled until something changes, then sends only the change', async () => {
    vi.mocked(updateProfile).mockResolvedValue(getProfileMock({ displayName: 'Jane Doe' }));
    const screen = await render(
      <>
        <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />
        <Toaster />
      </>,
    );

    await screen.getByRole('button', { name: 'Edit profile' }).click();
    const save = screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' });
    await expect.element(save).toBeDisabled();

    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByLabelText('Name')
      .fill('Jane Doe');
    await expect.element(save).toBeEnabled();
    await save.click();

    await expect
      .poll(() => vi.mocked(updateProfile).mock.calls[0]?.[0])
      .toEqual({
        displayName: 'Jane Doe',
      });
    await expect.element(screen.getByText('Profile saved')).toBeVisible();
    await expect
      .element(screen.getByRole('dialog', { name: 'Edit profile' }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText('Jane Doe')).toBeVisible();
  });

  it('sends only the unit system when the units are toggled', async () => {
    vi.mocked(updateProfile).mockResolvedValue(getProfileMock({ unitSystem: 'imperial' }));
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );

    await screen.getByRole('button', { name: 'Edit profile' }).click();
    await screen.getByRole('dialog', { name: 'Edit profile' }).getByText('Imperial').click();
    await expect
      .element(screen.getByRole('dialog', { name: 'Edit profile' }).getByLabelText('Weight'))
      .toHaveValue('175.9');
    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' })
      .click();

    await expect
      .poll(() => vi.mocked(updateProfile).mock.calls[0]?.[0])
      .toEqual({
        unitSystem: 'imperial',
      });
  });

  it('sends a typed weight in kg', async () => {
    vi.mocked(updateProfile).mockResolvedValue(getProfileMock({ latestWeightKg: 81.5 }));
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );

    await screen.getByRole('button', { name: 'Edit profile' }).click();
    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByLabelText('Weight')
      .fill('81,5');
    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' })
      .click();

    await expect
      .poll(() => vi.mocked(updateProfile).mock.calls[0]?.[0])
      .toEqual({ weightKg: 81.5 });
  });

  it('shows field errors from validation and blocks Save offline', async () => {
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );
    await screen.getByRole('button', { name: 'Edit profile' }).click();

    await screen.getByRole('dialog', { name: 'Edit profile' }).getByLabelText('Weight').fill('500');
    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' })
      .click();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Edit profile' })
          .getByText('Enter a weight between 30 kg and 300 kg'),
      )
      .toBeVisible();
    expect(updateProfile).not.toHaveBeenCalled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Edit profile' })
          .getByText("You're offline. Connect to the internet to save."),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Save' }),
      )
      .toBeDisabled();
  });

  it('does not focus the name on a phone, so the keyboard stays closed', async () => {
    await page.viewport(390, 844);
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );

    await screen.getByRole('button', { name: 'Edit profile' }).click();

    await expect.element(screen.getByRole('dialog', { name: 'Edit profile' })).toHaveFocus();
    await expect
      .element(screen.getByRole('dialog', { name: 'Edit profile' }).getByLabelText('Name'))
      .not.toHaveFocus();
  });

  it('focuses the name on desktop', async () => {
    await page.viewport(1440, 900);
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );

    await screen.getByRole('button', { name: 'Edit profile' }).click();

    await expect
      .element(screen.getByRole('dialog', { name: 'Edit profile' }).getByLabelText('Name'))
      .toHaveFocus();
  });

  it('scrolls a field error into view above the buttons on a phone', async () => {
    await page.viewport(390, 844);
    const screen = await render(
      <ProfileView initialGym={getGymMock()} initialProfile={getProfileMock()} />,
    );
    await screen.getByRole('button', { name: 'Edit profile' }).click();

    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('textbox', { name: 'Weight', exact: true })
      .fill('500');
    await screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' })
      .click();

    const error = screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByText('Enter a weight between 30 kg and 300 kg');
    await expect.element(error).toBeInViewport({ ratio: 1 });
    const errorBox = error.element().getBoundingClientRect();
    const saveBox = screen
      .getByRole('dialog', { name: 'Edit profile' })
      .getByRole('button', { name: 'Save' })
      .element()
      .getBoundingClientRect();
    expect(errorBox.bottom).toBeLessThan(saveBox.top);
  });
});
