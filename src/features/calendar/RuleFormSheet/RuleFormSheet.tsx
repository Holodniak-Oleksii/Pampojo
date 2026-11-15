import { AlertCircle } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePatchScheduleRuleMutation, usePutScheduleRuleMutation } from '@/api/plan';
import { useWorkoutsQuery } from '@/api/workouts';
import { ApiError } from '@/api/http';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Select } from '@/components/Select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SCHEDULE } from '@/constants/plan';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { shortDate, weekdayLong, weekdayShort } from '@/features/plan';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { addYears, isoWeekday, maxDate, nthOccurrence } from '@/shared/plan/occurrences';
import type { PutScheduleRuleInput, ScheduleRule } from '@/shared/schemas/plan';

export type RuleFormTarget = { kind: 'new'; date: string } | { kind: 'edit'; rule: ScheduleRule };

export interface RuleFormSheetProps {
  target: RuleFormTarget | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the start date of the saved rule. */
  onSaved: (startDate: string) => void;
}

export function RuleFormSheet({ target, today, onOpenChange, onSaved }: RuleFormSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="h-[calc(100dvh-52px)] gap-0 rounded-t-xl bg-card motion-reduce:animate-none data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[480px]"
      >
        {/* Keyed so each opening starts from the target's values and gets fresh client ids. */}
        {target ? (
          <RuleForm
            key={target.kind === 'edit' ? target.rule.id : `new-${target.date}`}
            target={target}
            today={today}
            onSaved={onSaved}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

type Repeat = 'once' | 'weekly';
type End = 'never' | 'date' | 'after';

function initialState(target: RuleFormTarget, today: string, firstWorkoutId: string) {
  if (target.kind === 'new') {
    const startDate = maxDate(target.date, today);
    return {
      workoutId: firstWorkoutId,
      startDate,
      repeat: 'weekly' as Repeat,
      weekdays: [isoWeekday(startDate)],
      interval: 1,
      end: 'never' as End,
      endDate: '',
      endAfter: '8',
    };
  }
  const { rule } = target;
  const once = rule.weekdays.length === 0;
  const startDate = maxDate(rule.startDate, today);
  return {
    workoutId: rule.workoutId,
    startDate,
    repeat: (once ? 'once' : 'weekly') as Repeat,
    weekdays: once ? [isoWeekday(startDate)] : rule.weekdays,
    interval: rule.intervalWeeks,
    end: (rule.endDate === null || once ? 'never' : 'date') as End,
    endDate: once ? '' : (rule.endDate ?? ''),
    endAfter: '8',
  };
}

function RuleForm({
  target,
  today,
  onSaved,
}: {
  target: RuleFormTarget;
  today: string;
  onSaved: (startDate: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const id = useId();
  const workouts = useWorkoutsQuery();
  const options = useMemo(
    () => (workouts.data?.items ?? []).filter((item) => item.exerciseCount > 0),
    [workouts.data],
  );
  const [form, setForm] = useState(() => initialState(target, today, options[0]?.id ?? ''));
  // Client ids are made once per opening, so a retried save finds the same rule (request-safety.md).
  const [ruleId] = useState(() => crypto.randomUUID());
  const [newId] = useState(() => crypto.randomUUID());
  const [serverError, setServerError] = useState<string | null>(null);
  const put = usePutScheduleRuleMutation();
  const patch = usePatchScheduleRuleMutation();
  const pending = put.isPending || patch.isPending;

  const edit = target.kind === 'edit';
  const started = edit && target.rule.startDate < today;
  const workoutId = form.workoutId || options[0]?.id || '';
  const workout = options.find((item) => item.id === workoutId);
  const weekly = form.repeat === 'weekly';
  const maxEnd = addYears(form.startDate, SCHEDULE.horizonYears);
  const afterCount = Number(form.endAfter);
  const afterValid =
    Number.isInteger(afterCount) && afterCount >= 1 && afterCount <= SCHEDULE.endAfterMax;
  const lastDate =
    weekly && form.end === 'after' && afterValid
      ? nthOccurrence(
          {
            startDate: form.startDate,
            endDate: null,
            weekdays: form.weekdays,
            intervalWeeks: form.interval,
          },
          afterCount,
        )
      : null;
  const endDateValid =
    form.end !== 'date' ||
    (form.endDate !== '' && form.endDate >= form.startDate && form.endDate <= maxEnd);
  const valid =
    workoutId !== '' &&
    form.startDate >= today &&
    (!weekly || form.weekdays.length > 0) &&
    endDateValid &&
    (!weekly || form.end !== 'after' || lastDate !== null);

  const update = (patch: Partial<typeof form>) => {
    setServerError(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  function toggleDay(day: number) {
    const has = form.weekdays.includes(day);
    // The last weekday stays on: a weekly rule needs at least one.
    if (has && form.weekdays.length === 1) return;
    update({
      weekdays: has
        ? form.weekdays.filter((item) => item !== day)
        : [...form.weekdays, day].sort((a, b) => a - b),
    });
  }

  function body(): PutScheduleRuleInput {
    if (!weekly) {
      return {
        workoutId,
        startDate: form.startDate,
        weekdays: [],
        intervalWeeks: 1,
        endDate: form.startDate,
      };
    }
    return {
      workoutId,
      startDate: form.startDate,
      weekdays: form.weekdays,
      intervalWeeks: form.interval,
      endDate: form.end === 'date' ? form.endDate : null,
      ...(form.end === 'after' ? { endAfter: afterCount } : {}),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || pending) return;
    try {
      if (target.kind === 'edit') {
        await patch.mutateAsync({ id: target.rule.id, input: { ...body(), newId } });
      } else {
        await put.mutateAsync({ id: ruleId, input: body() });
      }
      toast(t('Saved'));
      onSaved(form.startDate);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      setServerError(
        code === 'SCHEDULE_OVERLAP'
          ? t('{{name}} is already planned on these days.', {
              name: workout?.name ?? (edit ? target.rule.workout.name : ''),
            })
          : code === 'SCHEDULE_LIMIT_REACHED'
            ? t('You can have up to 100 active schedules.')
            : t("Couldn't save the schedule. Try again."),
      );
    }
  }

  const fieldLabel = 'mb-2 block text-sm font-bold';
  const dateInput =
    'h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:text-muted-foreground disabled:opacity-100';

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <span
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong lg:hidden"
      />
      <SheetHeader className="px-5 pt-3 pb-2 lg:px-7 lg:pt-6">
        <SheetTitle className="pr-10 text-xl font-extrabold">
          {edit ? t('Edit schedule') : t('Schedule workout')}
        </SheetTitle>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-2 pb-4 lg:px-7">
        <div>
          <label htmlFor={`${id}-workout`} className={fieldLabel}>
            {t('Workout')}
          </label>
          <div className="flex items-center gap-3">
            <ExerciseImage
              src={workout?.thumbnailUrls[0] ?? null}
              name={workout?.name ?? ''}
              alt=""
              compact
              className="size-12 shrink-0 rounded-sm"
            />
            <Select
              id={`${id}-workout`}
              className="flex-1"
              value={workoutId}
              onChange={(event) => update({ workoutId: event.target.value })}
            >
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.name} · ${t('{{count}} exercises', { count: item.exerciseCount })}`}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-start`} className={fieldLabel}>
            {t('Start date')}
          </label>
          <input
            id={`${id}-start`}
            type="date"
            className={dateInput}
            value={form.startDate}
            min={today}
            disabled={started}
            aria-describedby={started ? `${id}-start-note` : undefined}
            onChange={(event) => {
              const startDate = event.target.value;
              if (!startDate) return;
              update({
                startDate,
                ...(edit || form.weekdays.length > 1 ? {} : { weekdays: [isoWeekday(startDate)] }),
              });
            }}
          />
          {started ? (
            <p id={`${id}-start-note`} className="mt-1.5 text-sm text-muted-foreground">
              {t('Changes apply from today. Past workouts stay as they were.')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5">
          <SegmentedControl<Repeat>
            name={`${id}-repeat`}
            legend={t('Repeat')}
            options={[
              { value: 'once', label: t('Once') },
              { value: 'weekly', label: t('Weekly') },
            ]}
            value={form.repeat}
            onChange={(repeat) => update({ repeat })}
          />
          {weekly ? (
            <>
              <div role="group" aria-label={t('Days of the week')} className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const on = form.weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={weekdayLong(locale, day)}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'h-11 rounded-md border text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        on
                          ? 'border-foreground bg-foreground font-extrabold text-background'
                          : 'border-border-strong bg-card',
                      )}
                    >
                      {weekdayShort(locale, day)}
                    </button>
                  );
                })}
              </div>
              <label htmlFor={`${id}-interval`} className="sr-only">
                {t('Interval')}
              </label>
              <Select
                id={`${id}-interval`}
                value={String(form.interval)}
                onChange={(event) => update({ interval: Number(event.target.value) })}
              >
                <option value="1">{t('Every week')}</option>
                {[2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {t('Every {{count}} weeks', { count })}
                  </option>
                ))}
              </Select>
            </>
          ) : null}
        </div>

        {weekly ? (
          <div className="flex flex-col gap-2.5">
            <SegmentedControl<End>
              name={`${id}-end`}
              legend={t('Ends')}
              options={[
                { value: 'never', label: t('Never') },
                { value: 'date', label: t('On date') },
                { value: 'after', label: t('After') },
              ]}
              value={form.end}
              onChange={(end) => update({ end })}
            />
            {form.end === 'date' ? (
              <>
                <label htmlFor={`${id}-end-date`} className="sr-only">
                  {t('End date')}
                </label>
                <input
                  id={`${id}-end-date`}
                  type="date"
                  className={dateInput}
                  value={form.endDate}
                  min={form.startDate}
                  max={maxEnd}
                  aria-invalid={!endDateValid}
                  onChange={(event) => update({ endDate: event.target.value })}
                />
              </>
            ) : null}
            {form.end === 'after' ? (
              <div className="flex items-center gap-2.5">
                <label htmlFor={`${id}-after`} className="sr-only">
                  {t('Number of workouts')}
                </label>
                <input
                  id={`${id}-after`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={SCHEDULE.endAfterMax}
                  className="h-12 w-[72px] rounded-md border border-input bg-card text-center text-base font-bold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.endAfter}
                  aria-invalid={!afterValid || lastDate === null}
                  onChange={(event) => update({ endAfter: event.target.value })}
                />
                <span className="font-semibold">{t('times')}</span>
                {lastDate ? (
                  <span className="ml-auto text-sm text-muted-foreground">
                    {t('Last: {{date}}', { date: shortDate(locale, lastDate) })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border px-5 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] lg:px-7">
        {serverError ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-semibold text-destructive"
          >
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            {serverError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={!valid || pending}>
          {edit ? t('Save') : t('Schedule')}
        </Button>
      </div>
    </form>
  );
}
