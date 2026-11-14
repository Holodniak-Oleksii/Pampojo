'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/api/http';
import { useUpdateProfileMutation } from '@/api/profile';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { scrollToFirstError } from '@/lib/scroll-to-first-error';
import type { Profile } from '@/shared/schemas/profile';
import { BodyFields } from '../fields/BodyFields';
import { NameAvatarFields } from '../fields/NameAvatarFields';
import { SexBirthDateFields } from '../fields/SexBirthDateFields';
import {
  FIELD_GROUP,
  fieldErrorsFromIssues,
  formValuesFromProfile,
  profileFormSchema,
  toUpdateProfileInput,
  type ProfileFormValues,
} from '../form';

const ALL_GROUPS = [FIELD_GROUP.NAME, FIELD_GROUP.SEX_BIRTH, FIELD_GROUP.BODY] as const;

export interface EditProfileSheetProps {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileSheet({ profile, open, onOpenChange }: EditProfileSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          // Desktop only: focusing the name input on a phone would pop the keyboard over the sheet.
          if (desktop) return;
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="max-h-dvh overflow-y-auto rounded-t-[32px] bg-background data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-6 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">{t('Edit profile')}</SheetTitle>
        </SheetHeader>
        {/* Mounted only while open, so every opening starts from the current profile. */}
        {open ? <EditProfileForm profile={profile} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function EditProfileForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const mutation = useUpdateProfileMutation();
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState(false);
  const form = useForm<ProfileFormValues>({
    defaultValues: formValuesFromProfile(profile),
    resolver: zodResolver(profileFormSchema(ALL_GROUPS)),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { isDirty } = form.formState;

  const save = async (values: ProfileFormValues) => {
    if (inFlight.current) return;
    const body = toUpdateProfileInput(values, profile, form.formState.dirtyFields);
    if (Object.keys(body).length === 0) {
      onDone();
      return;
    }
    inFlight.current = true;
    setPending(true);
    setServerError(false);
    try {
      await mutation.mutateAsync(body);
      toast(t('Profile saved'));
      onDone();
      return;
    } catch (error) {
      const issues =
        error instanceof ApiError && error.code === 'VALIDATION_FAILED'
          ? fieldErrorsFromIssues(error.details, values.unitSystem)
          : [];
      if (issues.length === 0) setServerError(true);
      for (const { field, message } of issues) form.setError(field, { message });
      scrollToFirstError(formRef.current);
    }
    inFlight.current = false;
    setPending(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) =>
    form.handleSubmit(save, () => scrollToFirstError(formRef.current))(event);
  const shared = { form, idPrefix: 'edit-profile' };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col">
      <div className="flex flex-col gap-8 px-4 lg:px-6">
        <NameAvatarFields {...shared} />
        <SexBirthDateFields {...shared} />
        <BodyFields {...shared} />
      </div>
      <SheetFooter className="sticky bottom-0 gap-3 bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-6">
        {!online ? (
          <OfflineNotice>{t("You're offline. Connect to the internet to save.")}</OfflineNotice>
        ) : null}
        {serverError ? (
          <p
            role="alert"
            className="rounded-md bg-card px-4 py-3 text-sm font-semibold text-destructive"
          >
            {t('Something went wrong. Try again.')}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onDone}>
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={!isDirty || pending || !online}
          >
            {pending ? t('Saving…') : t('Save')}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
