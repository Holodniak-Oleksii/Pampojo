'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSaveMeasurementsMutation } from '@/api/measurements';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GIRTH_TYPES, MEASUREMENT_TYPES, type MeasurementType } from '@/constants/measurement';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { Measurement, PutMeasurementInput } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import { DateField } from '../DateField';
import { inputText, typeName, unitLabel } from '../utils';
import { measurementResolver, validateEntry } from './validation';

// Paired sides share a row; every other type spans both columns.
const HALF_WIDTH = new Set<MeasurementType>(
  GIRTH_TYPES.filter((type) => type.endsWith('_left') || type.endsWith('_right')),
);

const TYPE_SET = new Set<string>(MEASUREMENT_TYPES);

type AddValues = { measuredOn: string } & Partial<Record<MeasurementType, string>>;

export interface AddMeasurementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  today: string;
  latest: ReadonlyMap<MeasurementType, Measurement | undefined>;
  focusType?: MeasurementType;
}

export function AddMeasurementSheet({ open, onOpenChange, ...props }: AddMeasurementSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="gap-0 bg-card data-[side=bottom]:top-[72px] data-[side=bottom]:rounded-t-[8px] data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-5 pb-3 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">{t('Add measurement')}</SheetTitle>
        </SheetHeader>
        {/* Mounted only while open, so every opening starts empty. */}
        {open ? <AddMeasurementForm {...props} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function AddMeasurementForm({
  profile,
  today,
  latest,
  focusType,
  onDone,
}: Omit<AddMeasurementSheetProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const online = useIsOnline();
  const mutation = useSaveMeasurementsMutation();
  const units = profile.unitSystem;
  const resolver = useMemo(
    () =>
      measurementResolver<AddValues>(t, units, today, (key) =>
        TYPE_SET.has(key) ? (key as MeasurementType) : null,
      ),
    [t, units, today],
  );
  const form = useForm<AddValues>({
    defaultValues: { measuredOn: today },
    resolver,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control });
  const filled = MEASUREMENT_TYPES.filter((type) => (values[type] ?? '').trim() !== '');

  useEffect(() => {
    if (focusType) form.setFocus(focusType);
  }, [focusType, form]);

  const save = async (data: AddValues) => {
    const body: PutMeasurementInput[] = filled.map((type) => ({
      type,
      value: validateEntry(t, type, data[type] ?? '', units).value ?? 0,
      measuredOn: data.measuredOn,
    }));
    try {
      await mutation.mutateAsync(body);
      onDone();
    } catch {
      toast(t("Couldn't save. Try again."));
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 lg:px-6">
        <Field id="measurement-date" label={t('Date')} error={errors.measuredOn?.message}>
          <DateField
            id="measurement-date"
            value={values.measuredOn ?? ''}
            max={today}
            error={errors.measuredOn?.message}
            registration={form.register('measuredOn')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_TYPES.map((type) => {
            const id = `measurement-${type}`;
            const last = latest.get(type);
            const error = errors[type]?.message;
            const text = values[type] ?? '';
            return (
              <div key={type} className={cn(!HALF_WIDTH.has(type) && 'col-span-2')}>
                <Field id={id} label={typeName(t, type)} error={error}>
                  <span
                    className={cn(
                      'flex h-13 items-center gap-1.5 rounded-sm border-2 bg-background px-3.5',
                      text ? 'border-foreground' : 'border-transparent',
                      'focus-within:border-foreground',
                      error && 'border-destructive focus-within:border-destructive',
                    )}
                  >
                    <input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={last ? inputText(locale, type, last.value, units) : '—'}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-error` : undefined}
                      {...form.register(type)}
                      className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none placeholder:text-planned"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {unitLabel(t, type, units)}
                    </span>
                  </span>
                </Field>
              </div>
            );
          })}
        </div>
      </div>
      <SheetFooter className="border-t border-border p-4 lg:px-6">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={filled.length === 0 || mutation.isPending || !online}
        >
          {t('Save')}
        </Button>
        {online ? null : (
          <p role="status" className="text-center text-[13px] text-muted-foreground">
            {t('Needs internet')}
          </p>
        )}
      </SheetFooter>
    </form>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
