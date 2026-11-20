import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createMeasurementRepository,
  listLocalMeasurements,
  useLocalQuery,
  useOptionalLocalDb,
} from '@/services/local-db';
import {
  measurementListResponseSchema,
  putMeasurementResponseSchema,
  type Measurement,
  type PutMeasurementInput,
} from '@/shared/schemas/measurement';
import { http } from './http';
import { profileKeys } from './profile';

const PATH = '/api/v1/measurements';

export const measurementKeys = {
  all: ['measurements'] as const,
  list: () => [...measurementKeys.all, 'list'] as const,
};

export async function fetchMeasurements(): Promise<Measurement[]> {
  const { items } = await http(PATH, { schema: measurementListResponseSchema });
  return items;
}

export async function putMeasurement(id: string, input: PutMeasurementInput): Promise<Measurement> {
  const { item } = await http(`${PATH}/${id}`, {
    method: 'PUT',
    body: input,
    schema: putMeasurementResponseSchema,
  });
  return item;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await http(`${PATH}/${id}`, { method: 'DELETE' });
}

export function useMeasurementsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: measurementKeys.list(),
    db,
    read: listLocalMeasurements,
    remote: fetchMeasurements,
    enabled,
  });
}

// The profile shows the latest weight, so every measurement write refreshes it too.
function useInvalidateMeasurements() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: measurementKeys.all }),
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
    ]);
}

/** On the device, measurements save locally and sync later, so these work offline. */
function useMeasurementRepository() {
  const db = useOptionalLocalDb();
  return db ? createMeasurementRepository(db) : null;
}

/** Saves the inputs one by one, each with a new client id. */
export function useSaveMeasurementsMutation() {
  const invalidate = useInvalidateMeasurements();
  const repository = useMeasurementRepository();
  return useMutation({
    mutationFn: async (inputs: readonly PutMeasurementInput[]) => {
      for (const input of inputs) {
        if (repository) await repository.save(input);
        else await putMeasurement(crypto.randomUUID(), input);
      }
    },
    networkMode: repository ? 'always' : 'online',
    onSuccess: invalidate,
  });
}

export function useUpdateMeasurementMutation() {
  const invalidate = useInvalidateMeasurements();
  const repository = useMeasurementRepository();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PutMeasurementInput }) => {
      if (repository) await repository.update(id, input);
      else await putMeasurement(id, input);
    },
    networkMode: repository ? 'always' : 'online',
    onSuccess: invalidate,
  });
}

export function useDeleteMeasurementMutation() {
  const invalidate = useInvalidateMeasurements();
  const repository = useMeasurementRepository();
  return useMutation({
    mutationFn: (id: string) => (repository ? repository.remove(id) : deleteMeasurement(id)),
    networkMode: repository ? 'always' : 'online',
    onSuccess: invalidate,
  });
}
