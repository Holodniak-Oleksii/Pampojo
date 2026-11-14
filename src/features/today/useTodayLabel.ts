import { useSyncExternalStore } from 'react';
import { useLocale } from '@/i18n/client';

const subscribe = () => () => {};

function todayLabel(locale: string): string {
  const label = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

/** "Thursday, 13 November" on the device clock; `null` on the server and during hydration. */
export function useTodayLabel(): string | null {
  const locale = useLocale();
  return useSyncExternalStore(
    subscribe,
    () => todayLabel(locale),
    () => null,
  );
}
