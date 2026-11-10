import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeOnboarding } from '@/api/profile';
import { navigateAfterAuth } from '@/features/auth/utils';
import { getProfileMock } from '@/test/mocks';
import { render } from '@/test/render';
import { OnboardingFlow } from '../OnboardingFlow';

vi.mock('@/api/profile', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  const completeOnboarding = vi.fn();
  return {
    completeOnboarding,
    useCompleteOnboardingMutation: () => useMutation({ mutationFn: completeOnboarding }),
  };
});

vi.mock('@/features/auth/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/utils')>()),
  navigateAfterAuth: vi.fn(),
}));

const KEY = 'pampojo:onboarding:user-1';

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

function storeDraft(step: number, values: Record<string, unknown> = {}) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      step,
      values: {
        displayName: 'John Smith',
        avatarEmoji: 'owl',
        avatarColor: 5,
        sex: 'male',
        birthDay: '15',
        birthMonth: '05',
        birthYear: '1990',
        unitSystem: 'metric',
        heightCm: '',
        heightFt: '',
        heightIn: '',
        weight: '',
        ...values,
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingFlow', () => {
  it('starts with a random avatar and an empty name; Continue needs a name', async () => {
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await expect.element(screen.getByText('Step 1 of 3')).toBeVisible();
    const name = screen.getByLabelText('Name');
    await expect.element(name).toHaveValue('');
    await expect.element(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(
      screen
        .getByRole('group', { name: 'Avatar' })
        .getByRole('radio', { checked: true })
        .elements(),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole('group', { name: 'Background color' })
        .getByRole('radio', { checked: true })
        .elements(),
    ).toHaveLength(1);

    await name.fill('   ');
    await expect.element(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await name.fill('John');
    await expect.element(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('prefills the name it is given', async () => {
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="John Smith" />);

    await expect.element(screen.getByLabelText('Name')).toHaveValue('John Smith');
  });

  it('keeps values across Back and Continue', async () => {
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);
    await screen.getByLabelText('Name').fill('John');
    await screen.getByRole('radio', { name: 'Owl' }).click();

    await screen.getByRole('button', { name: 'Continue' }).click();
    await expect.element(screen.getByRole('heading', { name: 'A bit about you' })).toBeVisible();
    await screen.getByRole('button', { name: 'Back' }).click();

    await expect.element(screen.getByLabelText('Name')).toHaveValue('John');
    await expect.element(screen.getByRole('radio', { name: 'Owl' })).toBeChecked();
  });

  it('restores the step and values from storage after a reload', async () => {
    storeDraft(2);

    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await expect.element(screen.getByText('Step 2 of 3')).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Male' })).toBeChecked();
    await expect.element(screen.getByLabelText('DD')).toHaveValue('15');
  });

  it('starts fresh when the stored draft is broken', async () => {
    localStorage.setItem(KEY, '{not json');

    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await expect.element(screen.getByText('Step 1 of 3')).toBeVisible();
  });

  it('shows step 2 errors only after Continue', async () => {
    storeDraft(2, { sex: null, birthDay: '', birthMonth: '', birthYear: '' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);
    await expect.element(screen.getByText('Step 2 of 3')).toBeVisible();
    expect(screen.getByText('Choose one').elements()).toHaveLength(0);

    await screen.getByRole('button', { name: 'Continue' }).click();
    await expect.element(screen.getByText('Choose one')).toBeVisible();
    await expect.element(screen.getByText('Enter a valid date')).toBeVisible();

    await screen.getByLabelText('DD').fill('31');
    await screen.getByLabelText('MM').fill('02');
    await screen.getByLabelText('YYYY').fill('2000');
    await expect.element(screen.getByText('Enter a valid date')).toBeVisible();

    const year = new Date().getFullYear() - 10;
    await screen.getByLabelText('DD').fill('01');
    await screen.getByLabelText('YYYY').fill(String(year));
    await expect.element(screen.getByText('You must be at least 16 to use Pampojo')).toBeVisible();
  });

  it('shows the height and weight limits in the chosen unit', async () => {
    storeDraft(3, { heightCm: '99', weight: '29.9' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await screen.getByRole('button', { name: 'Finish' }).click();
    await expect
      .element(screen.getByText('Enter a height between 100 cm and 250 cm'))
      .toBeVisible();
    await expect.element(screen.getByText('Enter a weight between 30 kg and 300 kg')).toBeVisible();

    await screen.getByText('Imperial').click();
    await expect.element(screen.getByText('Enter a height between 3′4″ and 8′2″')).toBeVisible();
    await expect.element(screen.getByText('Enter a weight between 67 lb and 661 lb')).toBeVisible();
  });

  it('converts typed values when the units change', async () => {
    storeDraft(3, { heightCm: '180', weight: '79.8' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await screen.getByText('Imperial').click();

    await expect.element(screen.getByLabelText('Height, ft')).toHaveValue('5');
    await expect.element(screen.getByLabelText('Height, in')).toHaveValue('11');
    await expect.element(screen.getByLabelText('Weight')).toHaveValue('175.9');
  });

  it('finishes with canonical values, clears the draft and goes to /today', async () => {
    vi.mocked(completeOnboarding).mockResolvedValue(getProfileMock());
    storeDraft(3, { unitSystem: 'imperial', heightFt: '5', heightIn: '11', weight: '176' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await screen.getByRole('button', { name: 'Finish' }).click();

    await vi.waitFor(() => expect(navigateAfterAuth).toHaveBeenCalledWith('/today'));
    expect(vi.mocked(completeOnboarding).mock.calls[0]?.[0]).toMatchObject({
      displayName: 'John Smith',
      avatarEmoji: 'owl',
      avatarColor: 5,
      sex: 'male',
      birthDate: '1990-05-15',
      heightCm: 180.3,
      weightKg: 79.8,
      unitSystem: 'imperial',
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('shows the generic error and keeps the draft when the request fails', async () => {
    vi.mocked(completeOnboarding).mockRejectedValue(new Error('offline'));
    storeDraft(3, { heightCm: '180', weight: '80' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await screen.getByRole('button', { name: 'Finish' }).click();

    await expect.element(screen.getByText('Something went wrong. Try again.')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('lets steps 1–2 continue offline', async () => {
    setOnline(false);
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="John" />);

    await screen.getByRole('button', { name: 'Continue' }).click();

    await expect.element(screen.getByText('Step 2 of 3')).toBeVisible();
  });

  it('blocks Finish offline until the connection returns', async () => {
    setOnline(false);
    storeDraft(3, { heightCm: '180', weight: '80' });
    const screen = await render(<OnboardingFlow userId="user-1" prefillName="" />);

    await expect
      .element(screen.getByText("You're offline. Connect to the internet to save."))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();

    setOnline(true);
    await expect.element(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();
  });
});
