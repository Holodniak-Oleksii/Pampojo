'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SESSION_EXERCISES_MAX } from '@/constants/session';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';
import type { SessionExercise, SetLog } from '@/shared/schemas/session';
import { loggedCount } from '../utils';

export interface SessionExerciseListProps {
  exercises: SessionExercise[];
  setLogs: readonly SetLog[];
  currentId: string | null;
  /** Shows "Зараз" under the current row (the mobile sheet). */
  showNow?: boolean;
  onSelect: (entryId: string) => void;
  onReorder: (exercises: SessionExercise[]) => void;
  onRemove: (entryId: string) => void;
  onAdd: () => void;
}

function Row({
  entry,
  logged,
  current,
  showNow,
  onSelect,
  onRemove,
}: {
  entry: SessionExercise;
  logged: number;
  current: boolean;
  showNow: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex min-h-[68px] items-center gap-2 py-1.5 pr-3 pl-1',
        current ? 'rounded-md bg-input-surface' : 'border-b border-border last:border-b-0',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t('Drag {{name}}', { name: entry.exercise.name })}
        className="flex h-12 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-planned outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-current={current ? 'step' : undefined}
        onClick={onSelect}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExerciseImage
          src={entry.exercise.thumbnailUrl}
          name={entry.exercise.name}
          alt=""
          compact
          className="size-11 shrink-0 rounded-sm"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{entry.exercise.name}</span>
          {current && showNow ? (
            <span className="text-sm text-muted-foreground">{t('Now')}</span>
          ) : null}
        </span>
        <span
          className={cn(
            'tabular-nums',
            current ? 'font-bold' : 'font-semibold text-muted-foreground',
          )}
        >
          {logged}/{entry.plannedSets}
        </span>
      </button>
      {logged === 0 ? (
        <button
          type="button"
          aria-label={t('Remove {{name}}', { name: entry.exercise.name })}
          onClick={onRemove}
          className="flex h-12 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      ) : (
        <span className="w-11 shrink-0" />
      )}
    </li>
  );
}

/** The session's exercises: progress, reorder for this session only, add and remove. */
export function SessionExerciseList({
  exercises,
  setLogs,
  currentId,
  showNow = false,
  onSelect,
  onReorder,
  onRemove,
  onAdd,
}: SessionExerciseListProps) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (id: string | number) =>
    exercises.find((item) => item.id === id)?.exercise.name ?? '';
  const positionOf = (id: string | number) => exercises.findIndex((item) => item.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('Picked up "{{name}}".', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('"{{name}}" is at position {{position}} of {{total}}.', {
            name: nameOf(active.id),
            position: positionOf(over.id),
            total: exercises.length,
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

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = exercises.findIndex((item) => item.id === active.id);
    const to = exercises.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(exercises, from, to));
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={exercises.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="flex flex-col">
            {exercises.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                logged={loggedCount(entry, setLogs)}
                current={entry.id === currentId}
                showNow={showNow}
                onSelect={() => onSelect(entry.id)}
                onRemove={() => onRemove(entry.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button
        variant="secondary"
        disabled={!online || exercises.length >= SESSION_EXERCISES_MAX}
        title={online ? undefined : t('Needs internet')}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" />
        {t('Add exercise')}
      </Button>
      {online ? null : <p className="text-sm text-muted-foreground">{t('Needs internet')}</p>}
    </div>
  );
}
