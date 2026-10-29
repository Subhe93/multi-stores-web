import { describe, expect, it } from 'vitest';
import { formatFrame, parseValue } from './Counter';

const final = (raw: string) => {
  const p = parseValue(raw)!;
  return formatFrame(p, p.target);
};

describe('Counter parseValue / formatFrame', () => {
  it('keeps units around the leading number', () => {
    expect(parseValue('10K')).toMatchObject({ target: 10, suffixUnit: 'K' });
    expect(parseValue('4.9')).toMatchObject({ target: 4.9, decimals: 1 });
    expect(parseValue('1–3')).toMatchObject({ target: 1, suffixUnit: '–3' });
    expect(parseValue('€25')).toMatchObject({ target: 25, prefixUnit: '€' });
  });

  it('reads a decimal comma as a decimal (sv/de/fr/tr)', () => {
    expect(parseValue('2,8k')).toMatchObject({ target: 2.8, decimals: 1, decimalSeparator: ',', suffixUnit: 'k' });
    expect(parseValue('4,9')).toMatchObject({ target: 4.9, decimalSeparator: ',' });
  });

  it('reads comma + three digits as a thousands separator', () => {
    expect(parseValue('10,000')).toMatchObject({ target: 10000, decimals: 0, groupSeparator: ',' });
    expect(parseValue('1,250,000')).toMatchObject({ target: 1250000 });
  });

  it('formats every frame in the author’s notation and ends on the original', () => {
    for (const raw of ['10K', '4.9', '2,8k', '10,000', '1–3', '98', '0.5', '€25'])
      expect(final(raw)).toBe(raw);
    expect(formatFrame(parseValue('2,8k')!, 1.4)).toBe('1,4k');
    expect(formatFrame(parseValue('10,000')!, 2500)).toBe('2,500');
  });

  it('returns null when there is no number', () => {
    expect(parseValue('Free')).toBeNull();
    expect(parseValue('')).toBeNull();
  });
});
