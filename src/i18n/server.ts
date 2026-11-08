import { createInstance, type i18n as I18n } from 'i18next';
import { notFound } from 'next/navigation';
import { lang } from 'next/root-params';
import { i18nextOptions, isLocale, type Catalog, type Locale } from './config';

const catalogs: Record<Locale, () => Promise<Catalog>> = {
  en: () => import('./locales/en.json').then((module) => module.default),
  uk: () => import('./locales/uk.json').then((module) => module.default),
};

const instances = new Map<Locale, I18n>();

export async function getCatalog(locale: Locale): Promise<Catalog> {
  return catalogs[locale]();
}

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function getI18n() {
  const locale = await getLocale();
  let instance = instances.get(locale);
  if (!instance) {
    instance = createInstance();
    await instance.init(i18nextOptions(locale, await getCatalog(locale)));
    instances.set(locale, instance);
  }
  return { locale, t: instance.t };
}
