import { useQuery } from '@tanstack/react-query';
import {
  calendarResponseSchema,
  type CalendarQuery,
  type CalendarResponse,
} from '@/shared/schemas/calendar';
import { http } from './http';

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string) => [...calendarKeys.all, from, to] as const,
};

export function fetchCalendar({ from, to }: CalendarQuery): Promise<CalendarResponse> {
  const params = new URLSearchParams({ from, to });
  return http(`/api/v1/calendar?${params.toString()}`, { schema: calendarResponseSchema });
}

export function useCalendarQuery(
  range: CalendarQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: calendarKeys.range(range.from, range.to),
    queryFn: () => fetchCalendar(range),
    staleTime: 30_000,
    enabled,
  });
}
