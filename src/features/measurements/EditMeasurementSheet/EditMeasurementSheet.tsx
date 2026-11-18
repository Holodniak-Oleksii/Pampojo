'use client';

import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeleteMeasurementMutation, useUpdateMeasurementMutation } from '@/api/measurements';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { UnitSystem } from '@/constants/profile';
import { dayMonth } from '@/features/plan/formatPlanDate';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { Measurement } from '@/shared/schemas/measurement';
import { Field } from '../AddMeasurementSheet/AddMeasurementSheet';
import { measurementResolver, validateEntry } from '../AddMeasurementSheet/validation';
import { DateField } from '../DateField';
import { formatMeasurement, inputText, typeName, unitLabel } from '../utils';

interface EditValues {
  measuredOn: string;
  value: string;
}

export interface EditMeasurementSheetProps {
  measurement: Measurement | null;
  onOpenChange: (open: boolean) => void;
  units: UnitSystem;
  today: string;
}

export function EditMeasurementSheet({
  measurement,
  onOpenChange,
  ...props
}: EditMeasurementSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  return (
    <Sheet open={measurement !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="gap-0 bg-card data-[side=bottom]:rounded-t-[8px] data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-5 pb-3 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">{t('Edit measurement')}</SheetTitle>
          {measurement ? (
            <p className="text-[15px] text-muted-foreground">{typeName(t, measurement.type)}</p>
          ) : null}
        </SheetHeader>
        {measurement ? (
          <EditForm
            key={measurement.id}
            measurement={measurement}
            {...props}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({
  measurement,
  units,
  today,
  onDone,
}: Omit<EditMeasurementSheetProps, 'measurement' | 'onOpenChange'> & {
  measurement: Measurement;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const online = useIsOnline();
  const update = useUpdateMeasurementMutation();
  const remove = useDeleteMeasurementMutation();
  const { type } = measurement;
  const [confirming, setConfirming] = useState(false);
  const resolver = useMemo(
    () =>
      measurementResolver<EditValues>(t, units, today, (key) => (key === 'value' ? type : null)),
    [t, units, today, type],
  );
  const form = useForm<EditValues>({
    defaultValues: {
      measuredOn: measurement.measuredOn,
      value: inputText(locale, type, measurement.value, units),
    },
    resolver,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { errors } = form.formState;
  const date = useWatch({ control: form.control, name: 'measuredOn' });

  const save = async (data: EditValues) => {
    const value = validateEntry(t, type, data.value, units).value ?? measurement.value;
    try {
      await update.mutateAsync({
        id: measurement.id,
        input: { type, value, measuredOn: data.measuredOn },
      });
      onDone();
    } catch {
      toast(t("Couldn't save. Try again."));
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(measurement.id);
      setConfirming(false);
      onDone();
    } catch {
      toast(t("Couldn't save. Try again."));
    }
  };

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="flex flex-col gap-4 px-4 pb-4 lg:px-6"
    >
      <div className="flex flex-col gap-3">
        <Field id="edit-measurement-date" label={t('Date')} error={errors.measuredOn?.message}>
          <DateField
            id="edit-measurement-date"
            value={date}
            max={today}
            error={errors.measuredOn?.message}
            registration={form.register('measuredOn')}
          />
        </Field>
        <Field id="edit-measurement-value" label={typeName(t, type)} error={errors.value?.message}>
          <span
            className={cn(
              'flex h-13 items-center gap-1.5 rounded-sm border-2 border-foreground bg-background px-3.5',
              errors.value && 'border-destructive',
            )}
          >
            <input
              id="edit-measurement-value"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(errors.value)}
              aria-describedby={errors.value ? 'edit-measurement-value-error' : undefined}
              {...form.register('value')}
              className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none"
            />
            <span className="shrink-0 text-sm text-muted-foreground">
              {unitLabel(t, type, units)}
            </span>
          </span>
        </Field>
      </div>
      <Button type="submit" size="lg" disabled={update.isPending || !online}>
        {t('Save')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="text-destructive"
        disabled={remove.isPending || !online}
        onClick={() => setConfirming(true)}
      >
        {t('Delete')}
      </Button>
      {online ? null : (
        <p role="status" className="text-center text-[13px] text-muted-foreground">
          {t('Needs internet')}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('Delete this measurement?')}
        description={t('{{type}} {{value}}, {{date}}.', {
          type: typeName(t, type),
          value: formatMeasurement(t, locale, type, measurement.value, units),
          date: dayMonth(locale, measurement.measuredOn),
        })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        destructive
        stacked
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </form>
  );
}
