import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({
    queryKey: measurementKeys.list(),
    queryFn: fetchMeasurements,
    enabled,
    staleTime: 60_000,
    gcTime: 24 * 60 * 60_000,
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

/** Saves the inputs one by one, each with a new client id. */
export function useSaveMeasurementsMutation() {
  const invalidate = useInvalidateMeasurements();
  return useMutation({
    mutationFn: async (inputs: readonly PutMeasurementInput[]) => {
      for (const input of inputs) await putMeasurement(crypto.randomUUID(), input);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateMeasurementMutation() {
  const invalidate = useInvalidateMeasurements();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PutMeasurementInput }) =>
      putMeasurement(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteMeasurementMutation() {
  const invalidate = useInvalidateMeasurements();
  return useMutation({ mutationFn: (id: string) => deleteMeasurement(id), onSuccess: invalidate });
}
