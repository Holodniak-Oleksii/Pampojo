import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config';
import { resolveLocale } from '@/i18n/resolve-locale';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Pages live under a hidden [lang] segment; users only ever see unprefixed URLs.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const prefixed = LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (prefixed) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(prefixed.length + 1) || '/';
    const response = NextResponse.redirect(url, 307);
    response.cookies.set(LOCALE_COOKIE, prefixed, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
    return response;
  }

  const locale = resolveLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
  return NextResponse.rewrite(new URL(`/${locale}${pathname}${search}`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next|brand/|.*opengraph-image.*|.*\\..*).*)'],
};
