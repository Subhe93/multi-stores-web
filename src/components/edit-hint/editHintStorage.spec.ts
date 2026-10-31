import { describe, expect, it } from 'vitest';
import { isPlausibleToken, takeHandoffToken } from './editHintStorage';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdG9yZV9pZCI6InMifQ.c2lnbmF0dXJl';

describe('takeHandoffToken', () => {
  it('returns null when the URL carries no token (the visitor case)', () => {
    expect(takeHandoffToken('https://shop.test/products/mug?lang=sv#reviews')).toBeNull();
    expect(takeHandoffToken('https://shop.test/')).toBeNull();
  });

  it('reads the fragment and keeps the rest of the URL', () => {
    expect(takeHandoffToken(`https://shop.test/products/mug?x=1#ms_edit=${JWT}`)).toEqual({
      token: JWT,
      cleanUrl: '/products/mug?x=1',
    });
    expect(takeHandoffToken(`https://shop.test/#ms_edit=${JWT}&tab=2`)).toEqual({
      token: JWT,
      cleanUrl: '/#tab=2',
    });
  });

  it('ignores the query form (it would reach server logs)', () => {
    expect(takeHandoffToken(`https://shop.test/sv?ms_edit=${JWT}&lang=sv`)).toBeNull();
  });

  it('strips a junk value but stores nothing', () => {
    expect(takeHandoffToken('https://shop.test/#ms_edit=<script>')).toEqual({
      token: null,
      cleanUrl: '/',
    });
  });
});

describe('isPlausibleToken', () => {
  it('accepts JWT-shaped values only', () => {
    expect(isPlausibleToken(JWT)).toBe(true);
    expect(isPlausibleToken('a.b')).toBe(false);
    expect(isPlausibleToken('a.b.c d')).toBe(false);
    expect(isPlausibleToken(`${'a'.repeat(2048)}.b.c`)).toBe(false);
    expect(isPlausibleToken(null)).toBe(false);
  });
});
