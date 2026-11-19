import { vi } from 'vitest';

/** A `@/api/measurements` mock with real query hooks over mocked fetchers. */
export async function measurementsApiMock() {
  const { useMutation, useQuery, useQueryClient } = await import('@tanstack/react-query');
  const fetchMeasurements = vi.fn();
  const putMeasurement = vi.fn();
  const deleteMeasurement = vi.fn();
  const key = ['measurements', 'list'];
  const useInvalidate = () => {
    const client = useQueryClient();
    return () => client.invalidateQueries({ queryKey: key });
  };
  return {
    fetchMeasurements,
    putMeasurement,
    deleteMeasurement,
    useMeasurementsQuery: ({ enabled = true }: { enabled?: boolean } = {}) =>
      useQuery({ queryKey: key, queryFn: fetchMeasurements, enabled }),
    useSaveMeasurementsMutation: () => {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: async (inputs: unknown[]) => {
          for (const input of inputs) await putMeasurement(crypto.randomUUID(), input);
        },
        onSuccess: invalidate,
      });
    },
    useUpdateMeasurementMutation: () => {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, input }: { id: string; input: unknown }) => putMeasurement(id, input),
        onSuccess: invalidate,
      });
    },
    useDeleteMeasurementMutation: () => {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: (id: string) => deleteMeasurement(id),
        onSuccess: invalidate,
      });
    },
  };
}
