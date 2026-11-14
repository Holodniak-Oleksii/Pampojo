'use client';

import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocale } from '@/i18n/client';
import { LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config';

// Native names are shown as-is in every language.
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const locale = useLocale();

  const select = (value: string) => {
    if (!isLocale(value) || value === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    // The locale is a hidden root segment, so a reload is the only way to switch it.
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${t('Language')}: ${LANGUAGE_NAMES[locale]}`}
        >
          <Languages aria-hidden="true" />
          {LANGUAGE_NAMES[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[max(var(--radix-dropdown-menu-trigger-width),11rem)] rounded-lg p-1.5"
      >
        <DropdownMenuRadioGroup value={locale} onValueChange={select}>
          {(Object.keys(LANGUAGE_NAMES) as Locale[]).map((code) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              lang={code}
              className="rounded-md py-2.5 pr-10 pl-3 text-base"
            >
              {LANGUAGE_NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
