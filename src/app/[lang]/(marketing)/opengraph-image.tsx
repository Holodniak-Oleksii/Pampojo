import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { isLocale, type Catalog, type Locale } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';
import { OG_COLORS } from './og-colors';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Your workouts. Even offline.';

const HEADLINE_KEY = 'Your workouts. Even offline.';
const catalogs: Record<Locale, Catalog> = { en, uk };

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : 'en';
  const headline = catalogs[locale][HEADLINE_KEY] ?? HEADLINE_KEY;

  const [font, icon] = await Promise.all([
    readFile(join(process.cwd(), 'src/assets/fonts/Manrope-ExtraBold.ttf')),
    readFile(join(process.cwd(), 'public/brand/pampojo-icon.svg')),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 48,
        padding: 96,
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: 'Manrope',
      }}
    >
      <img
        src={`data:image/svg+xml;base64,${icon.toString('base64')}`}
        width={160}
        height={160}
        alt=""
      />
      <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
        {headline}
      </div>
      <div style={{ width: 160, height: 12, borderRadius: 6, background: OG_COLORS.accent }} />
    </div>,
    {
      ...size,
      fonts: [{ name: 'Manrope', data: font, weight: 800, style: 'normal' }],
    },
  );
}
