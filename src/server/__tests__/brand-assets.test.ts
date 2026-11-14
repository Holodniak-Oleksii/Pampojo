import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  'docs/brand/pampojo-icon.svg',
  'docs/brand/pampojo-wordmark.svg',
  'public/brand/pampojo-icon.svg',
  'public/brand/pampojo-wordmark.svg',
  'src/app/icon.svg',
];

describe('brand assets', () => {
  it.each(FILES)('%s uses the accent and charcoal of the visual language', (file) => {
    const svg = readFileSync(file, 'utf8').toUpperCase();
    // eslint-disable-next-line no-restricted-syntax -- --accent, asserted in the asset
    expect(svg).toContain('#EC8447');
    // eslint-disable-next-line no-restricted-syntax -- the new --foreground, asserted in the asset
    expect(svg).toContain('#24221F');
    // eslint-disable-next-line no-restricted-syntax -- the retired spec 01 accent
    expect(svg).not.toContain('#F59A62');
    // eslint-disable-next-line no-restricted-syntax -- the retired spec 01 charcoal
    expect(svg).not.toContain('#262626');
  });
});
