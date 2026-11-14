'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LATERALITY } from '@/constants/exercise';
import { TARGET_RANGE, WORKOUT_NOTE_MAX, type WorkoutTargets } from '@/constants/workout';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import type { DraftItem } from '../types';
import { allows } from '../utils';
import { NumberField } from './NumberField';

export interface ExerciseTargetsSheetProps {
  item: DraftItem | null;
  readOnly: boolean;
  onOpenChange: (open: boolean) => void;
  onTargets: (key: string, patch: Partial<WorkoutTargets>) => void;
  onNotes: (key: string, notes: string) => void;
  onRemove: (key: string) => void;
}

export function ExerciseTargetsSheet({ item, ...props }: ExerciseTargetsSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  return (
    <Sheet open={item !== null} onOpenChange={props.onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-xl bg-background pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none data-[side=right]:max-h-dvh data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[440px]"
      >
        {/* Keyed so each exercise starts with fresh field text and validity. */}
        {item ? <SheetBody key={item.key} item={item} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  item,
  readOnly,
  onOpenChange,
  onTargets,
  onNotes,
  onRemove,
}: Omit<ExerciseTargetsSheetProps, 'item'> & { item: DraftItem }) {
  const { t } = useTranslation();
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const { exercise, targets } = item;
  const perSide = exercise.laterality === LATERALITY.UNILATERAL ? t('per side') : undefined;

  const validity = (field: string) => (valid: boolean) =>
    setInvalid((current) => {
      const next = new Set(current);
      if (valid) next.delete(field);
      else next.add(field);
      return next;
    });
  const set = (patch: Partial<WorkoutTargets>) => onTargets(item.key, patch);

  // A single reps value means an exact number, so the other side follows it.
  const setReps = (side: 'min' | 'max', value: number | null) => {
    const other = side === 'min' ? targets.targetRepsMax : targets.targetRepsMin;
    const next = value === null ? null : value;
    if (side === 'min') set({ targetRepsMin: next, targetRepsMax: other ?? next });
    else set({ targetRepsMax: next, targetRepsMin: other ?? next });
  };
  const repsOrdered =
    targets.targetRepsMin === null ||
    targets.targetRepsMax === null ||
    targets.targetRepsMin <= targets.targetRepsMax;

  return (
    <div className="flex flex-col gap-4 px-4 pt-3 lg:px-6 lg:pt-6">
      <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-sm bg-border-strong lg:hidden" />
      <SheetHeader className="flex-row items-center gap-3 p-0 pr-10">
        <ExerciseImage
          src={exercise.thumbnailUrl}
          name={exercise.name}
          alt=""
          compact
          className="size-14 shrink-0 rounded-sm"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="text-xl leading-tight font-extrabold">{exercise.name}</SheetTitle>
          <Link
            href={`/library/exercises/${exercise.id}`}
            className="self-start text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
          >
            {t('How to do it')}
          </Link>
        </div>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t('Sets')}
          value={targets.targetSets}
          {...TARGET_RANGE.sets}
          disabled={readOnly}
          onChange={(value) => set({ targetSets: value })}
          onValidityChange={validity('sets')}
        />
        {allows(exercise.trackingType, 'weight') ? (
          <NumberField
            label={t('Weight, kg')}
            value={targets.targetWeightKg}
            min={TARGET_RANGE.weightKg.min}
            max={TARGET_RANGE.weightKg.max}
            step={TARGET_RANGE.weightKg.step}
            disabled={readOnly}
            onChange={(value) => set({ targetWeightKg: value })}
            onValidityChange={validity('weight')}
          />
        ) : null}
        {allows(exercise.trackingType, 'duration') ? (
          <NumberField
            label={t('Duration, s')}
            value={targets.targetDurationSec}
            {...TARGET_RANGE.durationSec}
            hint={perSide}
            disabled={readOnly}
            onChange={(value) => set({ targetDurationSec: value })}
            onValidityChange={validity('duration')}
          />
        ) : null}
        {allows(exercise.trackingType, 'distance') ? (
          <NumberField
            label={t('Distance, m')}
            value={targets.targetDistanceM}
            {...TARGET_RANGE.distanceM}
            disabled={readOnly}
            onChange={(value) => set({ targetDistanceM: value })}
            onValidityChange={validity('distance')}
          />
        ) : null}
        {allows(exercise.trackingType, 'reps') ? (
          <fieldset className="col-span-2 min-w-0">
            <legend className="mb-1.5 text-sm font-semibold text-muted-foreground">
              {t('Reps')}
            </legend>
            <div className="flex items-start gap-2.5">
              <div className="flex-1">
                <NumberField
                  label={t('From')}
                  hideLabel
                  value={targets.targetRepsMin}
                  {...TARGET_RANGE.reps}
                  disabled={readOnly}
                  onChange={(value) => setReps('min', value)}
                  onValidityChange={validity('repsMin')}
                />
              </div>
              <span aria-hidden="true" className="pt-3 text-muted-foreground">
                –
              </span>
              <div className="flex-1">
                <NumberField
                  label={t('To')}
                  hideLabel
                  value={targets.targetRepsMax}
                  {...TARGET_RANGE.reps}
                  disabled={readOnly}
                  onChange={(value) => setReps('max', value)}
                  onValidityChange={validity('repsMax')}
                />
              </div>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {repsOrdered
                ? (perSide ?? t('For an exact number, enter the same value twice.'))
                : null}
            </p>
            {!repsOrdered ? (
              <p className="text-sm text-destructive">
                {t('From {{min}} to {{max}}', {
                  min: targets.targetRepsMin,
                  max: TARGET_RANGE.reps.max,
                })}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted-foreground">{t('Note')}</span>
          <Input
            value={item.notes}
            maxLength={WORKOUT_NOTE_MAX}
            disabled={readOnly}
            onChange={(event) => onNotes(item.key, event.target.value)}
          />
        </label>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">{t('All fields are optional.')}</p>

      {readOnly ? null : (
        <div className="-mx-2.5 border-t border-border-strong pt-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(item.key)}
          >
            <Trash2 aria-hidden="true" />
            {t('Remove from workout')}
          </Button>
        </div>
      )}
      <Button
        className="w-full"
        disabled={invalid.size > 0 || !repsOrdered}
        onClick={() => onOpenChange(false)}
      >
        {t('Done')}
      </Button>
    </div>
  );
}
