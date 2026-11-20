import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/config';

const JUST_NOW_MS = 60_000;

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "щойно", "сьогодні о 17:42" or "20 листопада о 17:42", in the device time zone. */
export function formatSyncTime(t: TFunction, locale: Locale, at: string | null, now: Date): string {
  if (at === null) return t('Not synced yet');
  const date = new Date(at);
  if (now.getTime() - date.getTime() < JUST_NOW_MS) return t('just now');
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  if (sameDay(date, now)) return t('today at {{time}}', { time });
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
  return t('{{date}} at {{time}}', { date: day, time });
}

/** Why the server rejected a change, in words the user understands. */
export function rejectionReason(t: TFunction, code: string): string {
  switch (code) {
    case 'SESSION_NOT_FOUND':
      return t(
        'The workout was deleted on another device, so the server did not accept the change.',
      );
    case 'SESSION_NOT_IN_PROGRESS':
      return t('The workout was already finished on another device.');
    case 'MEASUREMENT_NOT_FOUND':
      return t('The measurement was deleted on another device.');
    case 'VALIDATION_FAILED':
      return t('The server did not accept the data of the change.');
    default:
      return t('The server did not accept the change.');
  }
}
