import 'server-only';
import { LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { resolveLocale } from '@/i18n/resolve-locale';

/** Locale of an API request: the `lang` cookie, then Accept-Language (API routes sit outside `[lang]`). */
export function requestLocale(request: Request): Locale {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  return resolveLocale({ cookie, acceptLanguage: request.headers.get('accept-language') });
}
