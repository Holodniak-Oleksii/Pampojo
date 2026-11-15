import { z } from 'zod';
import { SCHEDULE } from '@/constants/plan';
import { calendarDateSchema } from './utils';

export const scheduleRuleIdParamsSchema = z.object({ id: z.uuid() });

const weekdaysSchema = z
  .array(z.number().int().min(1).max(7))
  .max(7)
  .refine((days) => new Set(days).size === days.length, { error: 'Weekdays must be unique' })
  .transform((days) => [...days].sort((a, b) => a - b));

const ruleSettingsObject = z.object({
  workoutId: z.uuid(),
  startDate: calendarDateSchema,
  weekdays: weekdaysSchema,
  intervalWeeks: z.number().int().min(SCHEDULE.intervalMin).max(SCHEDULE.intervalMax),
  endDate: calendarDateSchema.nullable(),
  endAfter: z.number().int().min(1).max(SCHEDULE.endAfterMax).optional(),
});

type RuleSettings = z.infer<typeof ruleSettingsObject>;

function checkRuleSettings(value: RuleSettings, ctx: z.RefinementCtx) {
  if (value.endAfter !== undefined && value.endDate !== null) {
    ctx.addIssue({ code: 'custom', path: ['endAfter'], message: 'Use endDate or endAfter' });
  }
  if (value.weekdays.length === 0) {
    if (value.endAfter !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['endAfter'], message: 'A one-off has no endAfter' });
    }
    if (value.endDate !== value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'A one-off ends on its start' });
    }
  }
  if (value.endDate !== null && value.endDate < value.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end is before the start' });
  }
}

export const putScheduleRuleInputSchema = ruleSettingsObject
  .strict()
  .superRefine(checkRuleSettings);

export type PutScheduleRuleInput = z.input<typeof putScheduleRuleInputSchema>;
export type ParsedScheduleRuleSettings = z.output<typeof putScheduleRuleInputSchema>;

export const patchScheduleRuleInputSchema = ruleSettingsObject
  .extend({ newId: z.uuid() })
  .strict()
  .superRefine(checkRuleSettings);

export type PatchScheduleRuleInput = z.input<typeof patchScheduleRuleInputSchema>;
export type ParsedPatchScheduleRuleInput = z.output<typeof patchScheduleRuleInputSchema>;

export const scheduleRuleSchema = z.object({
  id: z.uuid(),
  workoutId: z.uuid(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  weekdays: z.array(z.number().int()),
  intervalWeeks: z.number().int(),
  updatedAt: z.string(),
  workout: z.object({
    id: z.uuid(),
    name: z.string(),
    exerciseCount: z.number().int(),
    deleted: z.boolean(),
  }),
});

export type ScheduleRule = z.infer<typeof scheduleRuleSchema>;

export const scheduleRuleListResponseSchema = z.object({ items: z.array(scheduleRuleSchema) });

export type ScheduleRuleListResponse = z.infer<typeof scheduleRuleListResponseSchema>;
