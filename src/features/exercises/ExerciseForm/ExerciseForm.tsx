'use client';

import { ArrowLeft, GripVertical, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/api/http';
import { useInvalidateExercises } from '@/api/exercises';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Select } from '@/components/Select';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  DESCRIPTION_MAX,
  MISTAKES_MAX_COUNT,
  STEP_MAX,
  STEPS_MAX_COUNT,
  TRACKING_TYPE,
  type Equipment,
  type Laterality,
  type Mechanic,
  type MovementPattern,
  type MuscleGroup,
  type TrackingType,
} from '@/constants/exercise';
import type { GymEquipment } from '@/constants/gym';
import { useIsOnline } from '@/hooks/useIsOnline';
import { scrollToFirstError } from '@/lib/scroll-to-first-error';
import { cn } from '@/lib/utils';
import {
  createExerciseInputSchema,
  EXERCISE_FIELD_ERROR,
  type Exercise,
} from '@/shared/schemas/exercise';
import { EquipmentFilter } from '../EquipmentFilter';
import { useExerciseLabels } from '../hooks/useExerciseLabels';
import { MuscleChips } from '../MuscleChips';
import { emptySlot, MIN_SLOTS, PhotoSlots, type PhotoSlot } from './PhotoSlots';
import { GymRequirementsField } from './GymRequirementsField';
import { FrameUploadFailed, saveExercise } from './save';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useDragReorder } from '../hooks/useDragReorder';

export interface ExerciseFormProps {
  mode: 'create' | 'edit';
  /** The exercise being edited. */
  exercise?: Exercise;
  /** Duplicate as my own: the system exercise to copy. */
  source?: Exercise;
}

interface FormValues {
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  trackingType: TrackingType;
  movementPattern: MovementPattern | '';
  mechanic: Mechanic | '';
  laterality: Laterality | '';
  description: string;
  instructions: { value: string }[];
  /** One mistake per line. */
  commonMistakes: string;
  gymEquipment: GymEquipment[][];
}

function initialValues(base: Exercise | undefined): FormValues {
  return {
    name: base?.name ?? '',
    primaryMuscles: base?.primaryMuscles ?? [],
    secondaryMuscles: base?.secondaryMuscles ?? [],
    equipment: base?.equipment ?? [],
    trackingType: base?.trackingType ?? TRACKING_TYPE.WEIGHT_REPS,
    movementPattern: base?.movementPattern ?? '',
    mechanic: base?.mechanic ?? '',
    laterality: base?.laterality ?? '',
    description: base?.description ?? '',
    instructions: (base?.instructions ?? []).map((value) => ({ value })),
    commonMistakes: (base?.commonMistakes ?? []).join('\n'),
    gymEquipment: (base?.gymEquipment ?? []).map((group) => [...group]),
  };
}

function initialSlots(exercise: Exercise | undefined, source: Exercise | undefined): PhotoSlot[] {
  const slots: PhotoSlot[] = exercise
    ? exercise.frames.map((frame) => ({
        ...emptySlot(),
        serverId: frame.id,
        previewUrl: frame.thumbUrl,
      }))
    : (source?.frames ?? []).map((frame, index) => ({
        ...emptySlot(),
        copyIndex: index,
        previewUrl: frame.thumbUrl,
      }));
  while (slots.length < MIN_SLOTS) slots.push(emptySlot());
  return slots;
}

const MISTAKES_TOO_MANY = 'mistakes_too_many';

export function ExerciseForm({ mode, exercise, source }: ExerciseFormProps) {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  const router = useRouter();
  const online = useIsOnline();
  const invalidate = useInvalidateExercises();
  const formRef = useRef<HTMLFormElement>(null);
  // One id per page visit, so a retried create finds the same row.
  const [id] = useState(() => exercise?.id ?? crypto.randomUUID());
  const copiedIds = useRef<string[] | null>(null);
  const [slots, setSlots] = useState(() => initialSlots(exercise, source));
  const [slotsDirty, setSlotsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const form = useForm<FormValues>({ defaultValues: initialValues(exercise ?? source) });
  const steps = useFieldArray({ control: form.control, name: 'instructions' });
  const stepDrag = useDragReorder((from, to) => steps.move(from, to), steps.fields.length);
  const [primary, secondary, name, equipment, gymEquipment] = useWatch({
    control: form.control,
    name: ['primaryMuscles', 'secondaryMuscles', 'name', 'equipment', 'gymEquipment'],
  });
  const errors = form.formState.errors;
  const dirty = !saved && (form.formState.isDirty || slotsDirty);
  useDiscardGuard(dirty);

  // The form validates on Save; editing a field clears its message right away.
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ name: field }) => {
          if (field) form.clearErrors(field as FieldPath<FormValues>);
        },
      }),
    [form],
  );

  // Object URLs of picked photos are revoked when the form goes away.
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(
    () => () => {
      for (const slot of slotsRef.current) {
        if (slot.blob && slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      }
    },
    [],
  );

  const cancelTo =
    mode === 'edit'
      ? `/library/exercises/${id}`
      : source
        ? `/library/exercises/${source.id}`
        : '/library/exercises';

  function leave(target: string) {
    if (dirty) setLeaveTo(target);
    else router.push(target);
  }

  function errorMessage(code: string | undefined, max?: number): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case EXERCISE_FIELD_ERROR.NAME_REQUIRED:
        return t('Enter a name.');
      case EXERCISE_FIELD_ERROR.NAME_TOO_LONG:
        return t('Up to 80 characters.');
      case EXERCISE_FIELD_ERROR.NAME_TAKEN:
        return t('You already have an exercise with this name.');
      case EXERCISE_FIELD_ERROR.PRIMARY_REQUIRED:
        return t('Pick at least one primary muscle.');
      case EXERCISE_FIELD_ERROR.EQUIPMENT_REQUIRED:
        return t('Pick at least one piece of equipment.');
      case MISTAKES_TOO_MANY:
        return t('Up to {{max}} mistakes, one per line.', { max: MISTAKES_MAX_COUNT });
      default:
        return t('Up to {{max}} characters.', { max: max ?? STEP_MAX });
    }
  }

  function toggle(field: 'primaryMuscles' | 'secondaryMuscles', muscle: MuscleGroup) {
    const current = form.getValues(field);
    form.setValue(
      field,
      current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle],
      { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
    );
  }

  function changeSlots(update: (current: PhotoSlot[]) => PhotoSlot[]) {
    setSlots(update);
    setSlotsDirty(true);
  }

  /** Blank list items are dropped by the schema, so error indexes point into the non-blank items. */
  function originalIndex(list: { value: string }[], index: number): number {
    const kept = list.flatMap((item, i) => (item.value.trim() ? [i] : []));
    return kept[index] ?? index;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);
    form.clearErrors();
    const values = form.getValues();
    const parsed = createExerciseInputSchema.safeParse({
      ...values,
      movementPattern: values.movementPattern || null,
      mechanic: values.mechanic || null,
      laterality: values.laterality || null,
      instructions: values.instructions.map((item) => item.value),
      commonMistakes: values.commonMistakes.split('\n'),
      sourceExerciseId: mode === 'create' ? (source?.id ?? null) : null,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [field, index] = issue.path;
        if (field === 'instructions') {
          const position = originalIndex(
            values.instructions,
            typeof index === 'number' ? index : 0,
          );
          form.setError(`instructions.${position}.value`, { message: issue.message });
        } else if (field === 'commonMistakes') {
          form.setError('commonMistakes', {
            message: typeof index === 'number' ? issue.message : MISTAKES_TOO_MANY,
          });
        } else if (typeof field === 'string') {
          form.setError(field as FieldPath<FormValues>, { message: issue.message });
        }
      }
      scrollToFirstError(formRef.current);
      return;
    }

    setSubmitting(true);
    try {
      await saveExercise({
        mode,
        id,
        input: parsed.data,
        slots,
        copiedIds: copiedIds.current,
        onCopied: (ids) => {
          copiedIds.current = ids;
        },
        onSlot: (key, patch) =>
          setSlots((current) =>
            current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)),
          ),
      });
      setSaved(true);
      invalidate(id);
      toast(t('Exercise saved'));
      router.push(`/library/exercises/${id}`);
    } catch (error) {
      if (error instanceof FrameUploadFailed) return;
      if (error instanceof ApiError && error.code === 'EXERCISE_NAME_TAKEN') {
        form.setError('name', { message: EXERCISE_FIELD_ERROR.NAME_TAKEN });
        scrollToFirstError(formRef.current);
      } else if (error instanceof ApiError && error.code === 'EXERCISE_LIMIT_REACHED') {
        setFormError(t("You've reached 300 exercises of your own."));
      } else {
        toast(t('Something went wrong. Try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selectField = <K extends 'trackingType' | 'movementPattern' | 'mechanic' | 'laterality'>(
    field: K,
    label: string,
    options: Record<string, string>,
    optional: boolean,
  ) => (
    <Field>
      <FieldLabel htmlFor={`exercise-${field}`}>{label}</FieldLabel>
      <Select id={`exercise-${field}`} {...form.register(field)}>
        {optional ? <option value="">{t('Not set')}</option> : null}
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </Select>
    </Field>
  );

  const stepsField = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{t('Steps')}</legend>
      <ol className="flex flex-col gap-2">
        {steps.fields.map((item, index) => {
          const message = errorMessage(errors.instructions?.[index]?.value?.message);
          const fieldLabel = `${t('Steps')} ${index + 1}`;
          return (
            <li
              key={item.id}
              ref={stepDrag.itemRef(index)}
              className={cn(
                'flex flex-col gap-1 rounded-md transition-shadow motion-reduce:transition-none',
                stepDrag.active === index && 'shadow-soft ring-2 ring-accent',
              )}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`${t('Drag to reorder')}, ${fieldLabel}`}
                  {...stepDrag.handleProps(index)}
                  className="flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                  <GripVertical aria-hidden="true" className="size-5" />
                </button>
                <Input
                  aria-label={fieldLabel}
                  aria-invalid={message ? true : undefined}
                  maxLength={STEP_MAX + 20}
                  {...form.register(`instructions.${index}.value`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('Remove')}, ${fieldLabel}`}
                  onClick={() => steps.remove(index)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {message ? <FieldError className="pl-12">{message}</FieldError> : null}
            </li>
          );
        })}
      </ol>
      {steps.fields.length < STEPS_MAX_COUNT ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => steps.append({ value: '' })}
        >
          <Plus aria-hidden="true" />
          {t('Add step')}
        </Button>
      ) : null}
    </fieldset>
  );

  const mistakesError = errorMessage(errors.commonMistakes?.message);
  const mistakesField = (
    <Field>
      <FieldLabel htmlFor="exercise-mistakes">{t('Common mistakes')}</FieldLabel>
      <textarea
        id="exercise-mistakes"
        rows={4}
        aria-invalid={mistakesError ? true : undefined}
        aria-describedby="exercise-mistakes-hint"
        className="min-h-28 w-full rounded-lg border border-input bg-card px-5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        {...form.register('commonMistakes')}
      />
      <p id="exercise-mistakes-hint" className="text-sm text-muted-foreground">
        {t('One mistake per line.')}
      </p>
      {mistakesError ? <FieldError>{mistakesError}</FieldError> : null}
    </Field>
  );

  const nameError = errorMessage(errors.name?.message);
  const primaryError = errorMessage(errors.primaryMuscles?.message);
  const equipmentError = errorMessage(errors.equipment?.message);
  const descriptionError = errorMessage(errors.description?.message, DESCRIPTION_MAX);
  const busy = submitting || !online;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-6"
    >
      <button
        type="button"
        onClick={() => leave(cancelTo)}
        className="-ml-2 flex min-h-11 items-center gap-2 self-start rounded-md px-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('Back')}
      </button>
      <h1 className="text-3xl font-extrabold md:text-4xl">
        {mode === 'edit' ? t('Edit exercise') : t('New exercise')}
      </h1>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <PhotoSlots
            name={name}
            slots={slots}
            onChange={changeSlots}
            onRetry={() => void submit()}
            disabled={submitting}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="exercise-name">{t('Name', { context: 'exercise' })}</FieldLabel>
            <Input
              id="exercise-name"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'exercise-name-error' : undefined}
              {...form.register('name')}
            />
            {nameError ? <FieldError id="exercise-name-error">{nameError}</FieldError> : null}
          </Field>

          <fieldset aria-describedby={primaryError ? 'exercise-primary-error' : undefined}>
            <legend className="mb-2 font-semibold">{t('Primary muscles')}</legend>
            <MuscleChips
              wrap
              label={t('Primary muscles')}
              selected={primary}
              onToggle={(muscle) => toggle('primaryMuscles', muscle)}
            />
            {primaryError ? (
              <FieldError id="exercise-primary-error" className="mt-2">
                {primaryError}
              </FieldError>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">{t('Secondary muscles')}</legend>
            <MuscleChips
              wrap
              label={t('Secondary muscles')}
              selected={secondary}
              onToggle={(muscle) => toggle('secondaryMuscles', muscle)}
            />
          </fieldset>

          <div aria-describedby={equipmentError ? 'exercise-equipment-error' : undefined}>
            <EquipmentFilter
              selected={equipment}
              onChange={(equipment) =>
                form.setValue('equipment', equipment, {
                  shouldDirty: true,
                  shouldValidate: form.formState.isSubmitted,
                })
              }
            />
            {equipmentError ? (
              <FieldError id="exercise-equipment-error" className="mt-2">
                {equipmentError}
              </FieldError>
            ) : null}
          </div>

          <GymRequirementsField
            value={gymEquipment}
            onChange={(value) => form.setValue('gymEquipment', value, { shouldDirty: true })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {selectField('trackingType', t('Tracking'), labels.tracking, false)}
            {selectField('movementPattern', t('Movement'), labels.pattern, true)}
            {selectField('mechanic', t('Type', { context: 'mechanic' }), labels.mechanic, true)}
            {selectField('laterality', t('Sides'), labels.laterality, true)}
          </div>

          <Field>
            <FieldLabel htmlFor="exercise-description">{t('Description')}</FieldLabel>
            <textarea
              id="exercise-description"
              rows={3}
              maxLength={DESCRIPTION_MAX + 20}
              aria-invalid={descriptionError ? true : undefined}
              className="min-h-24 w-full rounded-lg border border-input bg-card px-5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...form.register('description')}
            />
            {descriptionError ? <FieldError>{descriptionError}</FieldError> : null}
          </Field>

          {stepsField}
          {mistakesField}

          {/* Mobile keeps Save in reach above the bottom bar; desktop shows it inline. */}
          <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-2 bg-background/95 px-4 py-3 lg:static lg:mx-0 lg:bg-transparent lg:p-0">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button type="submit" size="lg" className="flex-1 lg:flex-none" disabled={busy}>
                {t('Save')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1 lg:flex-none"
                onClick={() => leave(cancelTo)}
              >
                {t('Cancel')}
              </Button>
            </div>
            {!online ? (
              <p className="text-sm text-muted-foreground">{t('Needs internet')}</p>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={leaveTo !== null}
        onOpenChange={(open) => !open && setLeaveTo(null)}
        title={t('Discard changes?')}
        description={t('Your changes will be lost.')}
        cancelLabel={t('Keep editing')}
        confirmLabel={t('Discard')}
        onConfirm={() => {
          const target = leaveTo;
          setSaved(true);
          setLeaveTo(null);
          if (target) router.push(target);
        }}
      />
    </form>
  );
}
