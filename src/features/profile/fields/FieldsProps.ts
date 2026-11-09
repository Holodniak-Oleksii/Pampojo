import type { UseFormReturn } from 'react-hook-form';
import type { ProfileFormValues } from '../form';

export interface FieldsProps {
  form: UseFormReturn<ProfileFormValues>;
  /** Prefix for element ids, so two forms on one page never collide. */
  idPrefix: string;
}
