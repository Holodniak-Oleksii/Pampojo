'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { useLocale } from '@/i18n/client';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { cn } from '@/lib/utils';
import type { DraftItem } from '../types';
import { targetSummary } from '../utils';

export const WORKOUT_DROP_ID = 'workout-exercises';

export interface WorkoutExerciseListProps {
  items: readonly DraftItem[];
  readOnly: boolean;
  /** Where a catalog item being dragged would land; null when nothing is dragged in. */
  dropIndex: number | null;
  onOpen: (key: string) => void;
}

function DropLine() {
  return (
    <li aria-hidden="true" data-testid="drop-indicator" className="relative h-0">
      <span className="absolute inset-x-2 -top-px h-[3px] rounded-sm bg-accent" />
      <Diamond tone="accent" size="md" className="absolute -top-[4px] left-0.5" />
    </li>
  );
}

function Row({
  item,
  readOnly,
  onOpen,
}: {
  item: DraftItem;
  readOnly: boolean;
  onOpen: (key: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key, disabled: readOnly });
  const summary = targetSummary(item, t, locale);
  const notes = item.notes.trim();

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: transition,
      }}
      className={cn(
        'flex items-center gap-1 border-b border-border bg-card last:border-b-0',
        isDragging && 'opacity-40',
      )}
    >
      {readOnly ? null : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={t('Drag {{name}}', { name: item.exercise.name })}
          className="ml-1.5 flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-planned outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpen(item.key)}
        className={cn(
          'flex min-h-[76px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:grid lg:min-h-[72px] lg:grid-cols-[48px_minmax(0,1fr)_180px] lg:gap-3.5 lg:pr-5',
          readOnly && 'pl-4',
        )}
      >
        <ExerciseImage
          src={item.exercise.thumbnailUrl}
          name={item.exercise.name}
          alt=""
          compact
          className="size-[52px] shrink-0 rounded-sm lg:size-12"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-bold">{item.exercise.name}</span>
          {summary ? (
            <span className="text-[15px] font-semibold tabular-nums lg:hidden">{summary}</span>
          ) : null}
          {notes ? <span className="truncate text-sm text-muted-foreground">{notes}</span> : null}
        </span>
        <span className="text-right text-[15px] font-semibold tabular-nums max-lg:hidden">
          {summary}
        </span>
      </button>
    </li>
  );
}

export function WorkoutExerciseList({
  items,
  readOnly,
  dropIndex,
  onOpen,
}: WorkoutExerciseListProps) {
  // The list itself is a target only while empty; otherwise the rows decide the drop position.
  const { setNodeRef } = useDroppable({
    id: WORKOUT_DROP_ID,
    disabled: readOnly || items.length > 0,
  });
  return (
    <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
      <ol
        ref={setNodeRef}
        // An empty desktop list is still a drop target, drawn as a dashed slot.
        className={cn(
          'relative rounded-lg',
          items.length === 0
            ? 'min-h-[76px] border-[1.5px] border-dashed border-planned max-lg:hidden'
            : 'bg-card',
        )}
      >
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {dropIndex === index ? <DropLine /> : null}
            <Row item={item} readOnly={readOnly} onOpen={onOpen} />
          </Fragment>
        ))}
        {dropIndex !== null && dropIndex >= items.length ? <DropLine /> : null}
      </ol>
    </SortableContext>
  );
}
