import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// #rgb, #rgba, #rrggbb, #rrggbbaa not followed by another word character.
const HEX_COLOR = '/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.recommended,
  // eslint-config-next already registers the jsx-a11y plugin; registering it again throws.
  { rules: jsxA11y.flatConfigs.recommended.rules },
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}'],
    ...testingLibrary.configs['flat/react'],
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      // The testing guide names the Vitest browser render result `screen`.
      'testing-library/render-result-naming-convention': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${HEX_COLOR}]`,
          message: 'Use a design token instead of a hex color.',
        },
        {
          selector: `TemplateElement[value.raw=${HEX_COLOR}]`,
          message: 'Use a design token instead of a hex color.',
        },
        {
          selector: "CallExpression[callee.name='t'][arguments.0.type!='Literal']",
          message: 't() needs a string literal key so extraction can see it.',
        },
        {
          selector: "CallExpression[callee.property.name='t'][arguments.0.type!='Literal']",
          message: 't() needs a string literal key so extraction can see it.',
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/components/ui/**',
    'src/server/db/migrations/**',
    'test-results/**',
    'playwright-report/**',
  ]),
]);
