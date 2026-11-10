import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import { ORIGINAL_PATH_HEADER } from '@/constants/routing';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config';
import { resolveLocale } from '@/i18n/resolve-locale';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const PROTECTED_PREFIXES = [
  '/today',
  '/onboarding',
  '/profile',
  '/calendar',
  '/library',
  '/progress',
  '/session',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

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

  // Cookie presence only: an optimistic hop. The (app) layout and auth pages validate the session.
  const hasSessionCookie = Boolean(getSessionCookie(request));
  if (pathname === '/' && hasSessionCookie) {
    return NextResponse.redirect(new URL('/today', request.url));
  }
  if (isProtected(pathname) && !hasSessionCookie) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const locale = resolveLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
  const forwarded = new Headers(request.headers);
  forwarded.set(ORIGINAL_PATH_HEADER, `${pathname}${search}`);
  return NextResponse.rewrite(new URL(`/${locale}${pathname}${search}`, request.url), {
    request: { headers: forwarded },
  });
}

export const config = {
  matcher: ['/((?!api|_next|brand/|.*opengraph-image.*|.*\\..*).*)'],
};
