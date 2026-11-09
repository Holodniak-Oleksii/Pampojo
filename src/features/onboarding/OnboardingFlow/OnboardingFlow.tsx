'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/http';
import { useCompleteOnboardingMutation } from '@/api/profile';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { UNIT_SYSTEM } from '@/constants/profile';
import {
  BodyFields,
  FIELD_GROUP,
  NameAvatarFields,
  SexBirthDateFields,
  fieldErrorsFromIssues,
  profileFormSchema,
  toCompleteOnboardingInput,
  type FieldGroup,
  type ProfileFormValues,
  scrollToFirstError,
} from '@/features/profile';
import { navigateAfterAuth } from '@/features/auth/utils';
import { useIsOnline } from '@/hooks/useIsOnline';
import {
  clearDraft,
  draftKey,
  saveDraft,
  useOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from '../hooks/useOnboardingDraft';

const STEP_GROUP: Record<OnboardingStep, FieldGroup> = {
  1: FIELD_GROUP.NAME,
  2: FIELD_GROUP.SEX_BIRTH,
  3: FIELD_GROUP.BODY,
};

const NEXT_STEP: Record<OnboardingStep, OnboardingStep> = { 1: 2, 2: 3, 3: 3 };
const PREV_STEP: Record<OnboardingStep, OnboardingStep> = { 1: 1, 2: 1, 3: 2 };

const FIELD_STEP: Partial<Record<keyof ProfileFormValues, OnboardingStep>> = {
  displayName: 1,
  avatarEmoji: 1,
  avatarColor: 1,
  sex: 2,
  birthDay: 2,
  birthMonth: 2,
  birthYear: 2,
};

const DESKTOP_QUERY = '(min-width: 1024px)';
const ID_PREFIX = 'onboarding';

export interface OnboardingFlowProps {
  userId: string;
  prefillName: string;
}

export function OnboardingFlow({ userId, prefillName }: OnboardingFlowProps) {
  const draft = useOnboardingDraft(userId, prefillName);
  if (!draft) return <OnboardingSkeleton />;
  return <OnboardingSteps storageKey={draftKey(userId)} initial={draft} />;
}

function OnboardingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="mx-auto size-24 rounded-full" />
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

function OnboardingSteps({
  storageKey,
  initial,
}: {
  storageKey: string;
  initial: OnboardingDraft;
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const [step, setStep] = useState<OnboardingStep>(initial.step);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState(false);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const stepRef = useRef(step);
  const mutation = useCompleteOnboardingMutation();

  // Each step validates only its own fields; the ref lets one form switch schemas between steps.
  const resolver: Resolver<ProfileFormValues> = (values, context, options) =>
    zodResolver(profileFormSchema([STEP_GROUP[stepRef.current]]))(values, context, options);

  const form = useForm<ProfileFormValues>({
    defaultValues: initial.values,
    resolver,
    // Errors appear only after the first Continue, then follow typing.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const displayName = useWatch({ control: form.control, name: 'displayName' });
  const unitSystem = useWatch({ control: form.control, name: 'unitSystem' });

  useEffect(() => {
    stepRef.current = step;
    saveDraft(storageKey, { version: 1, step, values: form.getValues() });
  }, [step, storageKey, form]);

  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: () =>
        saveDraft(storageKey, { version: 1, step: stepRef.current, values: form.getValues() }),
    });
  }, [form, storageKey]);

  // Desktop only: focusing on a phone would pop the keyboard over the step.
  useEffect(() => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    const first =
      step === 1
        ? 'displayName'
        : step === 2
          ? 'sex'
          : unitSystem === UNIT_SYSTEM.METRIC
            ? 'heightCm'
            : 'heightFt';
    form.setFocus(first);
    // Only on step change; switching units must not move the focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form]);

  const goTo = (next: OnboardingStep) => {
    // A fresh submit state per step, so the next step shows no errors before its own Continue.
    form.reset(form.getValues());
    setServerError(false);
    stepRef.current = next;
    setStep(next);
  };

  const finish = async (values: ProfileFormValues) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setServerError(false);
    try {
      await mutation.mutateAsync(toCompleteOnboardingInput(values));
      clearDraft(storageKey);
      // A full load: the (app) gate must see the new profile, not a cached RSC payload.
      navigateAfterAuth('/today');
      return;
    } catch (error) {
      const issues =
        error instanceof ApiError && error.code === 'VALIDATION_FAILED'
          ? fieldErrorsFromIssues(error.details, values.unitSystem)
          : [];
      if (issues.length === 0) setServerError(true);
      else {
        const steps = issues.map(({ field }) => FIELD_STEP[field] ?? 3);
        const earliest: OnboardingStep = steps.includes(1) ? 1 : steps.includes(2) ? 2 : 3;
        if (earliest !== 3) {
          stepRef.current = earliest;
          setStep(earliest);
        }
        for (const { field, message } of issues) form.setError(field, { message });
        scrollToFirstError(formRef.current);
      }
    }
    inFlight.current = false;
    setPending(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) =>
    form.handleSubmit(
      (values) => (step === 3 ? finish(values) : goTo(NEXT_STEP[step])),
      () => scrollToFirstError(formRef.current),
    )(event);

  const titles: Record<OnboardingStep, [string, string]> = {
    1: [t('What should we call you?'), t('Pick a name and an avatar.')],
    2: [t('A bit about you'), t('Used for body stats like BMI.')],
    3: [t('Height and weight'), t('You can change these later in your profile.')],
  };
  const [title, subtitle] = titles[step];
  const continueDisabled =
    pending || (step === 1 && displayName.trim() === '') || (step === 3 && !online);

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {t('Step {{step}} of 3', { step })}
        </p>
        <Progress value={(step / 3) * 100} aria-label={t('Step {{step}} of 3', { step })} />
      </div>

      <div className="mt-6 flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-6 flex-1">
        {step === 1 ? <NameAvatarFields form={form} idPrefix={ID_PREFIX} /> : null}
        {step === 2 ? <SexBirthDateFields form={form} idPrefix={ID_PREFIX} /> : null}
        {step === 3 ? <BodyFields form={form} idPrefix={ID_PREFIX} /> : null}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {step === 3 && !online ? (
          <OfflineNotice>{t("You're offline. Connect to the internet to save.")}</OfflineNotice>
        ) : null}
        {serverError ? (
          <p
            role="alert"
            className="rounded-2xl bg-card px-4 py-3 text-sm font-semibold text-destructive shadow-soft"
          >
            {t('Something went wrong. Try again.')}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 flex gap-3 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-0">
        {step > 1 ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={() => goTo(PREV_STEP[step])}
          >
            {t('Back')}
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="flex-1" disabled={continueDisabled}>
          {step === 3 ? (pending ? t('Finishing…') : t('Finish')) : t('Continue')}
        </Button>
      </div>
    </form>
  );
}
