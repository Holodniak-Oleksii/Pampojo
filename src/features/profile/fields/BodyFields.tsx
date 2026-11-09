'use client';

import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { UNIT_SYSTEM, type UnitSystem } from '@/constants/profile';
import { convertBodyFields, type ProfileFormField } from '../form';
import type { FieldsProps } from './FieldsProps';
import { useProfileFieldError } from './useProfileFieldError';

const BODY_FIELDS = ['heightCm', 'heightFt', 'heightIn', 'weight'] as const;

interface UnitInputProps extends FieldsProps {
  name: ProfileFormField;
  label: string;
  suffix: string;
  inputMode: 'numeric' | 'decimal';
  invalid: boolean;
  describedBy?: string;
}

function UnitInput({
  form,
  idPrefix,
  name,
  label,
  suffix,
  inputMode,
  invalid,
  describedBy,
}: UnitInputProps) {
  const id = `${idPrefix}-${name}`;
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        inputMode={inputMode}
        maxLength={6}
        className="pr-14"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        // Imperial height shows one error on the feet field, so editing inches re-checks it.
        {...form.register(name, name === 'heightIn' ? { deps: ['heightFt'] } : undefined)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-muted-foreground"
      >
        {suffix}
      </span>
    </div>
  );
}

export function BodyFields({ form, idPrefix }: FieldsProps) {
  const { t } = useTranslation();
  const fieldError = useProfileFieldError();
  const unitSystem = useWatch({ control: form.control, name: 'unitSystem' });
  const metric = unitSystem === UNIT_SYSTEM.METRIC;
  const { errors } = form.formState;
  const heightError = fieldError(
    (metric ? errors.heightCm : (errors.heightFt ?? errors.heightIn))?.message,
    unitSystem,
  );
  const weightError = fieldError(errors.weight?.message, unitSystem);
  const heightErrorId = `${idPrefix}-height-error`;
  const weightErrorId = `${idPrefix}-weight-error`;
  const unitOptions = useMemo(
    () => [
      { value: UNIT_SYSTEM.METRIC, label: t('Metric') },
      { value: UNIT_SYSTEM.IMPERIAL, label: t('Imperial') },
    ],
    [t],
  );

  const switchUnits = (next: UnitSystem, onChange: (value: UnitSystem) => void) => {
    if (next === unitSystem) return;
    const converted = convertBodyFields(form.getValues(), next);
    // Converted values are not user edits; only the unit choice itself marks the form dirty.
    for (const key of BODY_FIELDS) {
      const value = converted[key];
      if (value !== undefined) form.setValue(key, value, { shouldDirty: false });
    }
    onChange(next);
    if (form.formState.isSubmitted) void form.trigger(['heightCm', 'heightFt', 'weight']);
  };

  const shared = { form, idPrefix };
  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={form.control}
        name="unitSystem"
        render={({ field }) => (
          <SegmentedControl<UnitSystem>
            name={`${idPrefix}-units`}
            legend={t('Units')}
            hideLegend
            options={unitOptions}
            value={field.value}
            onChange={(value) => switchUnits(value, field.onChange)}
            inputRef={field.ref}
          />
        )}
      />

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={heightError ? heightErrorId : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">{t('Height')}</legend>
        {metric ? (
          <UnitInput
            {...shared}
            name="heightCm"
            label={t('Height')}
            suffix={t('cm')}
            inputMode="numeric"
            invalid={Boolean(heightError)}
            describedBy={heightError ? heightErrorId : undefined}
          />
        ) : (
          <div className="flex gap-2">
            <UnitInput
              {...shared}
              name="heightFt"
              label={`${t('Height')}, ${t('ft')}`}
              suffix={t('ft')}
              inputMode="numeric"
              invalid={Boolean(heightError)}
              describedBy={heightError ? heightErrorId : undefined}
            />
            <UnitInput
              {...shared}
              name="heightIn"
              label={`${t('Height')}, ${t('in')}`}
              suffix={t('in')}
              inputMode="numeric"
              invalid={Boolean(heightError)}
              describedBy={heightError ? heightErrorId : undefined}
            />
          </div>
        )}
        {heightError ? (
          <FieldError id={heightErrorId} className="text-destructive">
            {heightError}
          </FieldError>
        ) : null}
      </fieldset>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={weightError ? weightErrorId : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">{t('Weight')}</legend>
        <UnitInput
          {...shared}
          name="weight"
          label={t('Weight')}
          suffix={metric ? t('kg') : t('lb')}
          inputMode="decimal"
          invalid={Boolean(weightError)}
          describedBy={weightError ? weightErrorId : undefined}
        />
        {weightError ? (
          <FieldError id={weightErrorId} className="text-destructive">
            {weightError}
          </FieldError>
        ) : null}
      </fieldset>
    </div>
  );
}
