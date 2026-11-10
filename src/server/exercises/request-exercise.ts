import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { findExercise } from './service';

// One lookup per request, shared by the details page and its metadata.
export const getRequestExercise = cache((userId: string, locale: Locale, id: string) =>
  findExercise(userId, locale, id),
);
