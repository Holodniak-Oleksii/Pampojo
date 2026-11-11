import { createExercise, deleteFrame, updateExercise, uploadFrame } from '@/api/exercises';
import type { Exercise, ParsedCreateExerciseInput } from '@/shared/schemas/exercise';
import { hasPhoto, type PhotoSlot } from './PhotoSlots';

export class FrameUploadFailed extends Error {
  constructor(readonly slotKey: string) {
    super('Frame upload failed');
  }
}

export interface SaveRequest {
  mode: 'create' | 'edit';
  id: string;
  input: ParsedCreateExerciseInput;
  slots: PhotoSlot[];
  /** Duplicate: ids of the frames the server copied, by source index, once the row exists. */
  copiedIds: string[] | null;
  onSlot: (key: string, patch: Partial<PhotoSlot>) => void;
  onCopied: (ids: string[]) => void;
}

/**
 * Saves the row first, then each new photo, then removals and the order. Every step reuses the
 * same ids, so running it again after a failure only repeats what is missing.
 */
export async function saveExercise(request: SaveRequest): Promise<Exercise> {
  const { mode, id, input } = request;
  let exercise =
    mode === 'create'
      ? await createExercise(id, input)
      : await updateExercise(id, {
          name: input.name,
          primaryMuscles: input.primaryMuscles,
          secondaryMuscles: input.secondaryMuscles,
          equipment: input.equipment,
          trackingType: input.trackingType,
          movementPattern: input.movementPattern,
          mechanic: input.mechanic,
          laterality: input.laterality,
          description: input.description,
          instructions: input.instructions,
          commonMistakes: input.commonMistakes,
        });

  let copied = request.copiedIds;
  if (copied === null && input.sourceExerciseId) {
    copied = exercise.frames.flatMap((frame) => (frame.id ? [frame.id] : []));
    request.onCopied(copied);
  }

  const frameIdOf = (slot: PhotoSlot): string | null =>
    slot.blob
      ? slot.key
      : (slot.serverId ?? (slot.copyIndex !== null ? (copied?.[slot.copyIndex] ?? null) : null));

  for (const slot of request.slots) {
    if (!slot.blob) continue;
    request.onSlot(slot.key, { status: 'uploading', error: null });
    try {
      exercise = await uploadFrame(id, slot.key, slot.blob);
    } catch {
      request.onSlot(slot.key, { status: 'error', error: 'upload' });
      throw new FrameUploadFailed(slot.key);
    }
    // Uploaded: from now on the slot is a server frame with the same id.
    request.onSlot(slot.key, { status: 'idle', blob: null, serverId: slot.key });
  }

  const keep = request.slots.filter(hasPhoto).flatMap((slot) => {
    const frameId = frameIdOf(slot);
    return frameId ? [frameId] : [];
  });
  for (const frame of exercise.frames) {
    if (frame.id && !keep.includes(frame.id)) exercise = await deleteFrame(id, frame.id);
  }

  const current = exercise.frames.flatMap((frame) => (frame.id ? [frame.id] : []));
  if (current.length > 1 && current.join() !== keep.join()) {
    exercise = await updateExercise(id, { frameOrder: keep });
  }
  return exercise;
}
