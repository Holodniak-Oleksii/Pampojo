import { SCHEDULE } from '@/constants/plan';

/** The parts of a schedule rule that decide its dates. Dates are `YYYY-MM-DD`. */
export interface RuleShape {
  startDate: string;
  endDate: string | null;
  weekdays: readonly number[];
  intervalWeeks: number;
}

const DAY_MS = 86_400_000;

// Dates are handled as UTC day numbers so neither the device nor the profile time zone, nor a DST
// change, can move an occurrence.
function toDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDay(toDay(date) + days);
}

export function daysBetween(from: string, to: string): number {
  return toDay(to) - toDay(from);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  // Day 0 (1970-01-01) was a Thursday.
  return ((((toDay(date) + 3) % 7) + 7) % 7) + 1;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Feb 29 plus a year lands on Feb 28. */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const year = (y ?? 0) + years;
  const month = m ?? 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d ?? 1, last)).padStart(2, '0')}`;
}

export const minDate = (a: string, b: string) => (a < b ? a : b);
export const maxDate = (a: string, b: string) => (a > b ? a : b);

export function isOneOff(rule: RuleShape): boolean {
  return rule.weekdays.length === 0;
}

export function occursOn(rule: RuleShape, date: string): boolean {
  if (date < rule.startDate) return false;
  if (rule.endDate !== null && date > rule.endDate) return false;
  if (isOneOff(rule)) return date === rule.startDate;
  if (!rule.weekdays.includes(isoWeekday(date))) return false;
  const weeks = daysBetween(mondayOf(rule.startDate), mondayOf(date)) / 7;
  return weeks % rule.intervalWeeks === 0;
}

/** Sorted dates in `[from, to]` on which the rule occurs. */
export function expandOccurrences(rule: RuleShape, from: string, to: string): string[] {
  const first = maxDate(from, rule.startDate);
  const last = rule.endDate === null ? to : minDate(to, rule.endDate);
  const dates: string[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (occursOn(rule, date)) dates.push(date);
  }
  return dates;
}

/** The n-th occurrence (1-based), or null when it falls after the planning horizon. */
export function nthOccurrence(rule: RuleShape, n: number): string | null {
  const horizon = addYears(rule.startDate, SCHEDULE.horizonYears);
  const last = rule.endDate === null ? horizon : minDate(horizon, rule.endDate);
  let count = 0;
  for (let date = rule.startDate; date <= last; date = addDays(date, 1)) {
    if (occursOn(rule, date) && ++count === n) return date;
  }
  return null;
}

/** The first occurrence strictly after `after`, or null. */
export function nextOccurrence(rule: RuleShape, after: string): string | null {
  const from = maxDate(addDays(after, 1), rule.startDate);
  // A weekly pattern repeats within `intervalWeeks` weeks, so one period plus a week is enough.
  let to = addDays(from, rule.intervalWeeks * 7 + 7);
  if (rule.endDate !== null) to = minDate(to, rule.endDate);
  return expandOccurrences(rule, from, to)[0] ?? null;
}

/** The first date both rules occur on, or null. */
export function firstCommonDate(a: RuleShape, b: RuleShape): string | null {
  const from = maxDate(a.startDate, b.startDate);
  // 12 weeks is the least common multiple of the 1–4 week intervals.
  let to = addDays(from, 12 * 7 + 7);
  if (a.endDate !== null) to = minDate(to, a.endDate);
  if (b.endDate !== null) to = minDate(to, b.endDate);
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (occursOn(a, date) && occursOn(b, date)) return date;
  }
  return null;
}
