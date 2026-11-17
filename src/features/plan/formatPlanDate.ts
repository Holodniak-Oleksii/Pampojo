import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/config';
import { isoWeekday } from '@/shared/plan/occurrences';

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

/** "четвер" / "Thursday", as in "за четвер" / "for Thursday". */
export function weekdayFor(t: TFunction, weekday: number): string {
  switch (weekday) {
    case 1:
      return t('Monday', { context: 'for' });
    case 2:
      return t('Tuesday', { context: 'for' });
    case 3:
      return t('Wednesday', { context: 'for' });
    case 4:
      return t('Thursday', { context: 'for' });
    case 5:
      return t('Friday', { context: 'for' });
    case 6:
      return t('Saturday', { context: 'for' });
    default:
      return t('Sunday', { context: 'for' });
  }
}

/** "середи" / "Wednesday", as in "до середи" / "until Wednesday". */
export function weekdayUntil(t: TFunction, weekday: number): string {
  switch (weekday) {
    case 1:
      return t('Monday', { context: 'until' });
    case 2:
      return t('Tuesday', { context: 'until' });
    case 3:
      return t('Wednesday', { context: 'until' });
    case 4:
      return t('Thursday', { context: 'until' });
    case 5:
      return t('Friday', { context: 'until' });
    case 6:
      return t('Saturday', { context: 'until' });
    default:
      return t('Sunday', { context: 'until' });
  }
}

/** "Відпрацювати понеділкове Push Day?" for the weekday of the missed date. */
export function makeUpTitle(t: TFunction, date: string, name: string): string {
  switch (isoWeekday(date)) {
    case 1:
      return t("Make up Monday's {{name}}?", { name });
    case 2:
      return t("Make up Tuesday's {{name}}?", { name });
    case 3:
      return t("Make up Wednesday's {{name}}?", { name });
    case 4:
      return t("Make up Thursday's {{name}}?", { name });
    case 5:
      return t("Make up Friday's {{name}}?", { name });
    case 6:
      return t("Make up Saturday's {{name}}?", { name });
    default:
      return t("Make up Sunday's {{name}}?", { name });
  }
}

/** "у листопаді" / "in November" for a `YYYY-MM` month. */
export function monthIn(t: TFunction, month: string): string {
  switch (Number(month.slice(5, 7))) {
    case 1:
      return t('January', { context: 'in' });
    case 2:
      return t('February', { context: 'in' });
    case 3:
      return t('March', { context: 'in' });
    case 4:
      return t('April', { context: 'in' });
    case 5:
      return t('May', { context: 'in' });
    case 6:
      return t('June', { context: 'in' });
    case 7:
      return t('July', { context: 'in' });
    case 8:
      return t('August', { context: 'in' });
    case 9:
      return t('September', { context: 'in' });
    case 10:
      return t('October', { context: 'in' });
    case 11:
      return t('November', { context: 'in' });
    default:
      return t('December', { context: 'in' });
  }
}

/** "середи, 18 листопада" / "Wednesday, November 18": the last day to make a workout up. */
export function windowEndLabel(t: TFunction, locale: Locale, date: string): string {
  return `${weekdayUntil(t, isoWeekday(date))}, ${dayMonth(locale, date)}`;
}

/** "чт" / "Thu" for a date. */
export function weekdayShortOf(locale: Locale, date: string): string {
  return format(locale, date, { weekday: 'short' });
}

/** "Неділя, 15 листопада" / "Sunday, November 15". */
export function longDate(locale: Locale, date: string): string {
  return capitalize(
    locale,
    format(locale, date, { weekday: 'long', day: 'numeric', month: 'long' }),
  );
}

/** "52 хв" / "1 год 05 хв"; at least one minute. */
export function formatDuration(t: TFunction, seconds: number): string {
  const total = Math.max(1, Math.floor(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0
    ? t('{{hours}} h {{minutes}} min', { hours, minutes: String(minutes).padStart(2, '0') })
    : t('{{minutes}} min', { minutes });
}

/** "18:40" in the profile time zone. */
export function startTime(locale: Locale, startedAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(startedAt),
  );
}
