import { z } from 'zod';
import { limitsOf, MEASUREMENT_TYPE } from '@/constants/measurement';
import { calendarDateSchema, enumOf } from './utils';

// Messages are codes; forms translate them, so the schema stays shared with the server.
export const MEASUREMENT_FIELD_ERROR = {
  RANGE: 'measurement_range',
  DECIMALS: 'measurement_decimals',
  FUTURE: 'measurement_future',
  DATE: 'measurement_date',
} as const;

export const measurementTypeSchema = enumOf(MEASUREMENT_TYPE);

export const measurementIdParamsSchema = z.object({ id: z.uuid() });

/** True when `value` has at most `decimals` digits after the point. */
export function hasDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export const putMeasurementInputSchema = z
  .object({
    type: measurementTypeSchema,
    value: z.number({ error: MEASUREMENT_FIELD_ERROR.RANGE }),
    measuredOn: calendarDateSchema,
  })
  .strict()
  .superRefine((input, ctx) => {
    const limits = limitsOf(input.type);
    if (input.value < limits.min || input.value > limits.max) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: MEASUREMENT_FIELD_ERROR.RANGE });
    } else if (!hasDecimals(input.value, limits.decimals)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: MEASUREMENT_FIELD_ERROR.DECIMALS });
    }
  });

export type PutMeasurementInput = z.infer<typeof putMeasurementInputSchema>;

export const measurementSchema = z.object({
  id: z.uuid(),
  type: measurementTypeSchema,
  value: z.number(),
  measuredOn: z.string(),
  updatedAt: z.string(),
});

export type Measurement = z.infer<typeof measurementSchema>;

export const measurementListResponseSchema = z.object({ items: z.array(measurementSchema) });
export type MeasurementListResponse = z.infer<typeof measurementListResponseSchema>;

export const putMeasurementResponseSchema = z.object({ item: measurementSchema });
export type PutMeasurementResponse = z.infer<typeof putMeasurementResponseSchema>;
