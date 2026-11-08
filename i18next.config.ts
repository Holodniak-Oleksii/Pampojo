import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en', 'uk'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    ignore: ['src/**/__tests__/**', 'src/components/ui/**'],
    output: 'src/i18n/locales/{{language}}.json',
    defaultNS: false,
    keySeparator: false,
    nsSeparator: false,
    primaryLanguage: 'en',
    functions: ['t', '*.t'],
    useTranslationNames: ['useTranslation', 'getI18n'],
    removeUnusedKeys: true,
    sort: true,
    indentation: 2,
  },
});
