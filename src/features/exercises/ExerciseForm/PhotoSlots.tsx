'use client';

import { Ellipsis, GripVertical, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FRAME_LIMIT, IMAGE_TYPES } from '@/constants/exercise';
import { cn } from '@/lib/utils';
import { ExerciseImage } from '../ExerciseImage';
import { useDragReorder } from '../hooks/useDragReorder';
import {
  IMAGE_PICK_ERROR,
  ImagePickFailure,
  prepareImage,
  type ImagePickError,
} from './prepareImage';

export interface PhotoSlot {
  /** Frame id for uploads; a new uuid per picked photo. */
  key: string;
  /** Id of the frame on the server (editing), or null. */
  serverId: string | null;
  /** Duplicate: index of the source frame this slot copies, or null. */
  copyIndex: number | null;
  previewUrl: string | null;
  /** A newly picked, already scaled photo waiting for upload. */
  blob: Blob | null;
  status: 'idle' | 'uploading' | 'error';
  error: ImagePickError | 'upload' | null;
}

export const emptySlot = (): PhotoSlot => ({
  key: crypto.randomUUID(),
  serverId: null,
  copyIndex: null,
  previewUrl: null,
  blob: null,
  status: 'idle',
  error: null,
});

export const hasPhoto = (slot: PhotoSlot) =>
  slot.blob !== null || slot.serverId !== null || slot.copyIndex !== null;

/** The form always shows the start and end slots, even when empty. */
export const MIN_SLOTS = 2;

export interface PhotoSlotsProps {
  name: string;
  slots: PhotoSlot[];
  /** Functional updates: photo picks finish asynchronously and must not overwrite each other. */
  onChange: (update: (slots: PhotoSlot[]) => PhotoSlot[]) => void;
  onRetry: () => void;
  disabled: boolean;
}

function revoke(slot: PhotoSlot) {
  if (slot.blob && slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
}

export function PhotoSlots({ name, slots, onChange, onRetry, disabled }: PhotoSlotsProps) {
  const { t } = useTranslation();
  const inputs = useRef(new Map<string, HTMLInputElement>());

  // The first slot is the start and the last is the end; frames added later go in between.
  const label = (index: number) =>
    index === 0
      ? t('Start position')
      : index === slots.length - 1
        ? t('End position')
        : t('Frame {{n}}', { n: index + 1 });
  const errorText = (error: PhotoSlot['error']) =>
    error === IMAGE_PICK_ERROR.TYPE
      ? t('Use a JPEG, PNG or WebP image.')
      : error === IMAGE_PICK_ERROR.SIZE
        ? t('The image must be 5 MB or smaller.')
        : error === 'upload'
          ? t('Upload failed.')
          : null;

  const update = (key: string, patch: Partial<PhotoSlot>) =>
    onChange((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));

  async function pick(key: string, file: File | undefined) {
    if (!file) return;
    try {
      const blob = await prepareImage(file);
      onChange((current) =>
        current.map((slot) => {
          if (slot.key !== key) return slot;
          revoke(slot);
          // A replaced photo is a new frame; the old server frame is removed on save.
          return { ...emptySlot(), blob, previewUrl: URL.createObjectURL(blob) };
        }),
      );
    } catch (error) {
      update(key, {
        error: error instanceof ImagePickFailure ? error.reason : IMAGE_PICK_ERROR.TYPE,
      });
    }
  }

  function remove(key: string) {
    onChange((current) => {
      const slot = current.find((item) => item.key === key);
      if (slot) revoke(slot);
      return current.length > MIN_SLOTS
        ? current.filter((item) => item.key !== key)
        : current.map((item) => (item.key === key ? emptySlot() : item));
    });
  }

  const drag = useDragReorder((from, to) => {
    onChange((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }, slots.length);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 font-semibold">{t('Photos')}</legend>
      <ul className="flex flex-col gap-4">
        {slots.map((slot, index) => {
          const filled = hasPhoto(slot);
          const message = errorText(slot.error);
          const slotLabel = label(index);
          const openPicker = () => inputs.current.get(slot.key)?.click();
          return (
            <li
              key={slot.key}
              ref={drag.itemRef(index)}
              className={cn(
                'flex flex-col gap-2 rounded-md transition-shadow motion-reduce:transition-none',
                drag.active === index && 'shadow-soft ring-2 ring-accent',
              )}
            >
              <span className="text-sm text-muted-foreground">{slotLabel}</span>
              <div className="relative">
                {filled ? (
                  <ExerciseImage
                    src={slot.previewUrl}
                    name={name || slotLabel}
                    alt={`${name || t('Photos')}, ${slotLabel}`}
                    className="aspect-[4/3] w-full rounded-md"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={openPicker}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-foreground/20 bg-card text-sm text-muted-foreground outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <ImagePlus aria-hidden="true" className="size-6" />
                    {t('Add photo')}
                    <span className="sr-only">, {slotLabel}</span>
                  </button>
                )}
                {filled && !disabled ? (
                  <>
                    <button
                      type="button"
                      aria-label={`${t('Drag to reorder')}, ${slotLabel}`}
                      {...drag.handleProps(index)}
                      className="absolute top-3 left-3 flex size-10 cursor-grab items-center justify-center rounded-md bg-background/85 text-foreground shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden="true" className="size-5" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${t('Photo actions')}, ${slotLabel}`}
                          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-md bg-background/85 text-foreground shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Ellipsis aria-hidden="true" className="size-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem className="min-h-11" onSelect={openPicker}>
                          <ImagePlus aria-hidden="true" />
                          {t('Replace photo')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="min-h-11" onSelect={() => remove(slot.key)}>
                          <Trash2 aria-hidden="true" />
                          {t('Remove photo')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : null}
                {slot.status === 'uploading' ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
                    <Loader2
                      aria-hidden="true"
                      className="size-6 animate-spin motion-reduce:animate-none"
                    />
                  </span>
                ) : null}
              </div>
              <input
                ref={(node) => {
                  if (node) inputs.current.set(slot.key, node);
                  else inputs.current.delete(slot.key);
                }}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  void pick(slot.key, event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {message ? (
                <p
                  role="alert"
                  className="flex flex-wrap items-center gap-2 text-sm text-destructive"
                >
                  {message}
                  {slot.error === 'upload' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onRetry}
                      disabled={disabled}
                    >
                      {t('Retry')}
                    </Button>
                  ) : null}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {slots.length < FRAME_LIMIT ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={disabled}
          // A new frame goes before the end position, so the last slot stays the end.
          onClick={() =>
            onChange((current) => [...current.slice(0, -1), emptySlot(), ...current.slice(-1)])
          }
        >
          <Plus aria-hidden="true" />
          {t('Add frame')}
        </Button>
      ) : null}
    </fieldset>
  );
}
