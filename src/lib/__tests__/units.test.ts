import { describe, expect, it } from 'vitest';
import {
  cmFromFeetInches,
  feetInchesFromCm,
  formatFeetInches,
  kgFromLb,
  lbFromKg,
  parseDecimal,
  parseInteger,
} from '../units';

describe('unit conversions', () => {
  it('converts 5′11″ to 180.3 cm', () => {
    expect(cmFromFeetInches(5, 11)).toBe(180.3);
  });

  it('converts 176 lb to 79.8 kg', () => {
    expect(kgFromLb(176)).toBe(79.8);
  });

  it('shows 180 cm as 5′11″', () => {
    expect(formatFeetInches(feetInchesFromCm(180))).toBe('5′11″');
  });

  it('converts 79.8 kg to 175.9 lb', () => {
    expect(lbFromKg(79.8)).toBe(175.9);
  });

  it('puts the imperial height limits on the right side of 100–250 cm', () => {
    expect(cmFromFeetInches(3, 3)).toBeLessThan(100);
    expect(cmFromFeetInches(3, 4)).toBeGreaterThanOrEqual(100);
    expect(cmFromFeetInches(8, 2)).toBeLessThanOrEqual(250);
    expect(cmFromFeetInches(8, 3)).toBeGreaterThan(250);
  });

  it('puts the lb limits on the right side of 30–300 kg', () => {
    expect(kgFromLb(66)).toBeLessThan(30);
    expect(kgFromLb(67)).toBeGreaterThanOrEqual(30);
    expect(kgFromLb(661)).toBeLessThanOrEqual(300);
    expect(kgFromLb(662)).toBeGreaterThan(300);
  });
});

describe('parseDecimal', () => {
  it('accepts a comma or a dot with one decimal', () => {
    expect(parseDecimal('79,8')).toBe(79.8);
    expect(parseDecimal(' 79.8 ')).toBe(79.8);
    expect(parseDecimal('80')).toBe(80);
  });

  it('rejects more decimals, signs and text', () => {
    expect(parseDecimal('79.85')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('parseInteger', () => {
  it('accepts whole numbers only', () => {
    expect(parseInteger('180')).toBe(180);
    expect(parseInteger('180.5')).toBeNull();
    expect(parseInteger('')).toBeNull();
  });
});
