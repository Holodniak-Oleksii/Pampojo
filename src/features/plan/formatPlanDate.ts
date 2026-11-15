import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/config';

/** "у середу" / "on Wednesday" for an ISO weekday. Literal keys so extraction finds them. */
export function weekdayOn(t: TFunction, weekday: number): string {
  switch (weekday) {
    case 1:
      return t('Monday', { context: 'on' });
    case 2:
      return t('Tuesday', { context: 'on' });
    case 3:
      return t('Wednesday', { context: 'on' });
    case 4:
      return t('Thursday', { context: 'on' });
    case 5:
      return t('Friday', { context: 'on' });
    case 6:
      return t('Saturday', { context: 'on' });
    default:
      return t('Sunday', { context: 'on' });
  }
}

/** "щопонеділка" / "Monday" for an ISO weekday, used in "Every …" summaries. */
export function weekdayEvery(t: TFunction, weekday: number): string {
  switch (weekday) {
    case 1:
      return t('Monday', { context: 'every' });
    case 2:
      return t('Tuesday', { context: 'every' });
    case 3:
      return t('Wednesday', { context: 'every' });
    case 4:
      return t('Thursday', { context: 'every' });
    case 5:
      return t('Friday', { context: 'every' });
    case 6:
      return t('Saturday', { context: 'every' });
    default:
      return t('Sunday', { context: 'every' });
  }
}

// Plan dates are calendar dates, so they are formatted as UTC midnight to never shift a day.
function format(locale: Locale, date: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)),
  );
}

export function capitalize(locale: Locale, text: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** "Сьогодні, неділя, 15 листопада" for today, "Четвер, 3 грудня" otherwise. */
export function dayHeading(t: TFunction, locale: Locale, date: string, today: string): string {
  const label = format(locale, date, { weekday: 'long', day: 'numeric', month: 'long' });
  return date === today ? t('Today, {{date}}', { date: label }) : capitalize(locale, label);
}

/** "у середу, 18 листопада" / "on Wednesday, November 18". */
export function nextDateLabel(t: TFunction, locale: Locale, date: string, weekday: number): string {
  return `${weekdayOn(t, weekday)}, ${format(locale, date, { day: 'numeric', month: 'long' })}`;
}

/** "чт, 10 грудня" / "Thu, December 10". */
export function shortDate(locale: Locale, date: string): string {
  return format(locale, date, { weekday: 'short', day: 'numeric', month: 'long' });
}

/** "Листопад 2026" / "November 2026" for a `YYYY-MM` month. */
export function monthTitle(locale: Locale, month: string): string {
  // uk `{ month, year }` appends " р.", so the year is added by hand.
  return `${capitalize(locale, format(locale, `${month}-01`, { month: 'long' }))} ${month.slice(0, 4)}`;
}

/** "Пн" / "Mon" for an ISO weekday. */
export function weekdayShort(locale: Locale, weekday: number): string {
  // 2024-01-01 was a Monday.
  return format(locale, `2024-01-0${weekday}`, { weekday: 'short' });
}

/** "15 листопада" / "November 15". */
export function dayMonth(locale: Locale, date: string): string {
  return format(locale, date, { day: 'numeric', month: 'long' });
}

/** "понеділок" / "Monday" for an ISO weekday. */
export function weekdayLong(locale: Locale, weekday: number): string {
  return format(locale, `2024-01-0${weekday}`, { weekday: 'long' });
}
