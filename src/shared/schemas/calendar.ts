import { z } from 'zod';
import { CALENDAR_RANGE_MAX_DAYS, OCCURRENCE_STATUS, SESSION_KIND } from '@/constants/plan';
import { daysBetween } from '@/shared/plan/occurrences';
import { sessionListItemSchema } from './session';
import { calendarDateSchema, enumOf } from './utils';

export const calendarQuerySchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .strict()
  .refine(({ from, to }) => from <= to && daysBetween(from, to) + 1 <= CALENDAR_RANGE_MAX_DAYS, {
    error: `Expected a range of 1 to ${CALENDAR_RANGE_MAX_DAYS} days`,
    path: ['to'],
  });

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarOccurrenceSchema = z.object({
  ruleId: z.uuid(),
  workoutId: z.uuid(),
  workoutName: z.string(),
  status: enumOf(OCCURRENCE_STATUS),
  sessionId: z.uuid().nullable(),
  lateWindowEnd: calendarDateSchema.nullable(),
});

export const calendarSessionSchema = sessionListItemSchema.extend({
  kind: enumOf(SESSION_KIND),
});

export const calendarDaySchema = z.object({
  date: calendarDateSchema,
  occurrences: z.array(calendarOccurrenceSchema),
  sessions: z.array(calendarSessionSchema),
});

export const calendarResponseSchema = z.object({
  today: calendarDateSchema,
  days: z.array(calendarDaySchema),
});

export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
