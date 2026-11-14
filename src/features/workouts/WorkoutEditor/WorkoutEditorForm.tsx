'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/api/http';
import { usePutWorkoutMutation } from '@/api/workouts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  WORKOUT_DESCRIPTION_MAX,
  WORKOUT_EXERCISES_MAX,
  WORKOUT_NAME_MAX,
} from '@/constants/workout';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import type { ExerciseListItem } from '@/shared/schemas/exercise';
import { CatalogColumn, type CatalogDragData } from '../CatalogColumn';
import { ExercisePicker } from '../ExercisePicker';
import { ExerciseTargetsSheet } from '../ExerciseTargetsSheet';
import { useWorkoutDraft } from '../hooks/useWorkoutDraft';
import type { Draft } from '../types';
import { canSave, newDraftItem, summaryOf, toPutInput } from '../utils';
import { WORKOUT_DROP_ID, WorkoutExerciseList } from '../WorkoutExerciseList';

const LIST_PATH = '/library/workouts';

interface ActiveDrag {
  name: string;
  thumbnailUrl: string | null;
}

function catalogData(data: unknown): CatalogDragData | null {
  return typeof data === 'object' && data !== null && 'kind' in data && data.kind === 'catalog'
    ? (data as CatalogDragData)
    : null;
}

export function WorkoutEditorForm({ initial }: { initial: Draft }) {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useIsOnline();
  const desktop = useIsDesktop();
  const readOnly = !online;
  const [draft, dispatch] = useWorkoutDraft(initial);
  const save = usePutWorkoutMutation();
  const [saved, setSaved] = useState(false);
  const dirty = !saved && JSON.stringify(draft) !== JSON.stringify(initial);
  useDiscardGuard(dirty);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropIndex, setDropIndexState] = useState<number | null>(null);
  // The drop handler can run before React re-renders with the last move's index.
  const dropIndexRef = useRef<number | null>(null);
  const setDropIndex = (index: number | null) => {
    dropIndexRef.current = index;
    setDropIndexState(index);
  };

  const room = WORKOUT_EXERCISES_MAX - draft.items.length;
  const savable = canSave(draft);
  const openItem = draft.items.find((item) => item.key === openKey) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) =>
    draft.items.find((item) => item.key === id)?.exercise.name ?? '';
  const positionOf = (id: string | number) => draft.items.findIndex((item) => item.key === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('Picked up "{{name}}".', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('"{{name}}" is at position {{position}} of {{total}}.', {
            name: nameOf(active.id),
            position: positionOf(over.id),
            total: draft.items.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('"{{name}}" was dropped at position {{position}}.', {
            name: nameOf(active.id),
            position: positionOf(over.id),
          })
        : t('Dragging cancelled.'),
    onDragCancel: () => t('Dragging cancelled.'),
  };

  function add(items: ExerciseListItem[], index?: number) {
    const fitting = items.slice(0, Math.max(room, 0));
    if (fitting.length === 0) return;
    dispatch({ type: 'add', items: fitting.map((item) => newDraftItem(summaryOf(item))), index });
  }

  function onDragStart({ active }: DragStartEvent) {
    const fromCatalog = catalogData(active.data.current);
    if (fromCatalog) {
      setActiveDrag({ name: fromCatalog.item.name, thumbnailUrl: fromCatalog.item.thumbnailUrl });
      return;
    }
    const item = draft.items.find((entry) => entry.key === active.id);
    if (item) setActiveDrag({ name: item.exercise.name, thumbnailUrl: item.exercise.thumbnailUrl });
  }

  // Recomputed on every move: the pointer can cross a row's middle without changing the target.
  function updateDropIndex({ active, over }: DragOverEvent | DragMoveEvent) {
    if (!catalogData(active.data.current)) return;
    if (!over) return setDropIndex(null);
    if (over.id === WORKOUT_DROP_ID) return setDropIndex(draft.items.length);
    const index = draft.items.findIndex((item) => item.key === over.id);
    if (index < 0) return setDropIndex(null);
    const dragged = active.rect.current.translated;
    const below = dragged
      ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2
      : false;
    setDropIndex(below ? index + 1 : index);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const fromCatalog = catalogData(active.data.current);
    if (fromCatalog) {
      const index = dropIndexRef.current;
      if (over && index !== null) add([fromCatalog.item], index);
    } else if (over && active.id !== over.id) {
      const from = draft.items.findIndex((item) => item.key === active.id);
      const to = draft.items.findIndex((item) => item.key === over.id);
      if (from >= 0 && to >= 0) dispatch({ type: 'move', from, to });
    }
    setActiveDrag(null);
    setDropIndex(null);
  }

  function leave(event?: MouseEvent) {
    if (!dirty) return;
    event?.preventDefault();
    setDiscardOpen(true);
  }

  async function submit() {
    try {
      await save.mutateAsync({ id: draft.id, input: toPutInput(draft) });
      setSaved(true);
      toast(t('Workout saved'));
      router.push(LIST_PATH);
    } catch (error) {
      toast(
        error instanceof ApiError && error.code === 'WORKOUT_LIMIT_REACHED'
          ? t('You can have up to 200 workouts.')
          : t("Couldn't save the workout. Try again."),
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragOver={updateDropIndex}
      onDragMove={updateDropIndex}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveDrag(null);
        setDropIndex(null);
      }}
    >
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <Link
          href={LIST_PATH}
          onClick={leave}
          className="inline-flex min-h-11 items-center gap-2 self-start font-semibold lg:col-span-2"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
          {t('Workouts')}
        </Link>

        {desktop ? (
          <CatalogColumn disabled={readOnly || room <= 0} onAdd={(item) => add([item])} />
        ) : null}

        <div className="flex min-w-0 flex-col gap-5">
          <h1 className="text-lg font-extrabold max-lg:sr-only">{t('Workout')}</h1>
          <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-muted-foreground">
                {t('Name', { context: 'exercise' })}
              </span>
              <Input
                value={draft.name}
                maxLength={WORKOUT_NAME_MAX}
                disabled={readOnly}
                onChange={(event) => dispatch({ type: 'setName', name: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-muted-foreground">
                {t('Description')}
              </span>
              {desktop ? (
                <Input
                  value={draft.description}
                  maxLength={WORKOUT_DESCRIPTION_MAX}
                  placeholder={t('Optional')}
                  disabled={readOnly}
                  onChange={(event) =>
                    dispatch({ type: 'setDescription', description: event.target.value })
                  }
                />
              ) : (
                <textarea
                  rows={2}
                  value={draft.description}
                  maxLength={WORKOUT_DESCRIPTION_MAX}
                  placeholder={t('Optional')}
                  disabled={readOnly}
                  onChange={(event) =>
                    dispatch({ type: 'setDescription', description: event.target.value })
                  }
                  className="resize-none rounded-md border border-input bg-card px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:opacity-50"
                />
              )}
            </label>
          </div>

          <section aria-labelledby="workout-exercises" className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="workout-exercises" className="text-lg font-extrabold">
                {t('Exercises')}
              </h2>
              <span className="text-right text-muted-foreground">
                {t('{{count}} exercises', { count: draft.items.length })}
                <span className="max-lg:hidden">
                  {readOnly ? null : ` ${t('Drag from the catalog or press +.')}`}
                </span>
              </span>
            </div>
            <WorkoutExerciseList
              items={draft.items}
              readOnly={readOnly}
              dropIndex={dropIndex}
              onOpen={setOpenKey}
            />
            {desktop ? null : (
              <Button
                variant="secondary"
                disabled={readOnly || room <= 0}
                onClick={() => setPickerOpen(true)}
              >
                <Plus aria-hidden="true" />
                {t('Add exercises')}
              </Button>
            )}
            {room <= 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('Up to 30 exercises in a workout.')}
              </p>
            ) : null}
          </section>

          <div className="flex flex-col gap-2 lg:flex-row-reverse lg:items-center lg:justify-start lg:gap-3">
            <Button
              size="lg"
              className="w-full lg:w-auto"
              disabled={readOnly || !savable || save.isPending}
              aria-describedby="save-hint"
              onClick={() => void submit()}
            >
              {t('Save')}
            </Button>
            <Button asChild variant="ghost" size="lg" className="w-full lg:w-auto">
              <Link href={LIST_PATH} onClick={leave}>
                {t('Cancel')}
              </Link>
            </Button>
          </div>
          <p id="save-hint" className="-mt-3 text-sm text-muted-foreground lg:text-right">
            {readOnly
              ? t('Needs internet')
              : savable
                ? null
                : t('Add a name and at least one exercise to save.')}
          </p>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? (
          <div className="flex w-[340px] -rotate-[1.5deg] items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-soft">
            <ExerciseImage
              src={activeDrag.thumbnailUrl}
              name={activeDrag.name}
              alt=""
              compact
              className="size-11 shrink-0 rounded-sm"
            />
            <span className="font-bold">{activeDrag.name}</span>
          </div>
        ) : null}
      </DragOverlay>

      <ExerciseTargetsSheet
        item={openItem}
        readOnly={readOnly}
        onOpenChange={(open) => (open ? undefined : setOpenKey(null))}
        onTargets={(key, patch) => dispatch({ type: 'setTargets', key, patch })}
        onNotes={(key, notes) => dispatch({ type: 'setNotes', key, notes })}
        onRemove={(key) => {
          dispatch({ type: 'remove', key });
          setOpenKey(null);
        }}
      />
      {desktop ? null : (
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          room={room}
          onAdd={(items) => {
            add(items);
            setPickerOpen(false);
          }}
        />
      )}
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('Discard changes?')}
        description={t('Your changes will be lost.')}
        cancelLabel={t('Keep editing')}
        confirmLabel={t('Discard')}
        onConfirm={() => {
          setDiscardOpen(false);
          setSaved(true);
          router.push(LIST_PATH);
        }}
      />
    </DndContext>
  );
}
