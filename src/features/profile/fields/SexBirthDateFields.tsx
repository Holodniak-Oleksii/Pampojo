'use client';

import { useMemo, type ChangeEvent } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SEX, type Sex } from '@/constants/profile';
import type { ProfileFormField } from '../form';
import type { FieldsProps } from './FieldsProps';
import { useProfileFieldError } from './useProfileFieldError';

export function SexBirthDateFields({ form, idPrefix }: FieldsProps) {
  const { t } = useTranslation();
  const fieldError = useProfileFieldError();
  const unitSystem = useWatch({ control: form.control, name: 'unitSystem' });
  const { errors } = form.formState;
  const sexError = fieldError(errors.sex?.message, unitSystem);
  const dateError = fieldError(
    errors.birthDay?.message ?? errors.birthMonth?.message ?? errors.birthYear?.message,
    unitSystem,
  );
  const sexOptions = useMemo(
    () => [
      { value: SEX.MALE, label: t('Male') },
      { value: SEX.FEMALE, label: t('Female') },
    ],
    [t],
  );
  const dateErrorId = `${idPrefix}-birth-date-error`;

  // Moving on after the second digit keeps the numeric keyboard open across the three fields.
  const autoAdvance =
    (name: ProfileFormField, next: ProfileFormField | null, length: number) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, length);
      form.setValue(name, digits, { shouldDirty: true });
      // The date error lives on the day field for the whole group, so any part re-checks it.
      if (form.formState.isSubmitted) void form.trigger('birthDay');
      if (next && digits.length === length) form.setFocus(next);
    };

  const dateInput = (
    name: 'birthDay' | 'birthMonth' | 'birthYear',
    label: string,
    length: number,
    next: ProfileFormField | null,
    autoComplete: string,
  ) => {
    const id = `${idPrefix}-${name}`;
    const { name: fieldName, ref, onBlur } = form.register(name);
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete={autoComplete}
          maxLength={length}
          placeholder={label}
          className="text-center"
          aria-invalid={Boolean(dateError)}
          aria-describedby={dateError ? dateErrorId : undefined}
          name={fieldName}
          ref={ref}
          onBlur={onBlur}
          onChange={autoAdvance(name, next, length)}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={form.control}
        name="sex"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <SegmentedControl<Sex>
              name={`${idPrefix}-sex`}
              legend={t('Sex')}
              options={sexOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              invalid={Boolean(sexError)}
              describedBy={sexError ? `${idPrefix}-sex-error` : undefined}
            />
            {sexError ? (
              <FieldError id={`${idPrefix}-sex-error`} className="text-destructive">
                {sexError}
              </FieldError>
            ) : null}
          </div>
        )}
      />

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={dateError ? dateErrorId : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">{t('Date of birth')}</legend>
        <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2">
          {dateInput('birthDay', t('DD'), 2, 'birthMonth', 'bday-day')}
          {dateInput('birthMonth', t('MM'), 2, 'birthYear', 'bday-month')}
          {dateInput('birthYear', t('YYYY'), 4, null, 'bday-year')}
        </div>
        {dateError ? (
          <FieldError id={dateErrorId} className="text-destructive">
            {dateError}
          </FieldError>
        ) : null}
      </fieldset>
    </div>
  );
}
