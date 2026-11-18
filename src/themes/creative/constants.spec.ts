import { describe, expect, it } from 'vitest';
import {
  accentSize,
  ACCENT_SIZES,
  COMMERCE_SEGMENTS,
  CREATIVE_SECTION_KEYS,
  headingRevealValue,
  imageRevealDirection,
  imageRevealValue,
  isBrandPath,
  isBrandSegment,
} from './constants';

describe('accentSize (owner decision: no giant words)', () => {
  it('offers sm and md only', () => {
    expect([...ACCENT_SIZES]).toEqual(['sm', 'md']);
  });
  it('keeps sm and md', () => {
    expect(accentSize('sm')).toBe('sm');
    expect(accentSize('md')).toBe('md');
  });
  it.each(['lg', 'xl', '2xl', 'giant', '', 'SM', 3, null, undefined, {}])('maps %j to md', (raw) => {
    expect(accentSize(raw)).toBe('md');
  });
});

describe('option sanitizers', () => {
  it('default to the neutral value', () => {
    expect(headingRevealValue(undefined)).toBe('none');
    expect(headingRevealValue('lines')).toBe('lines');
    expect(headingRevealValue('chars')).toBe('none');
    expect(imageRevealValue('mask')).toBe('mask');
    expect(imageRevealValue(true)).toBe('none');
    expect(imageRevealDirection('start')).toBe('start');
    expect(imageRevealDirection('end')).toBe('end');
    expect(imageRevealDirection('left')).toBe('up');
  });
});

describe('route scope', () => {
  it('home and page slugs are brand pages', () => {
    expect(isBrandSegment(null)).toBe(true);
    expect(isBrandSegment('our-impact')).toBe(true);
    expect(isBrandSegment('about')).toBe(true);
  });
  it.each([...COMMERCE_SEGMENTS])('%s is a commerce segment', (segment) => {
    expect(isBrandSegment(segment)).toBe(false);
  });
  it('tests the first path segment after one locale prefix', () => {
    expect(isBrandPath('/')).toBe(true);
    expect(isBrandPath('/ar')).toBe(true);
    expect(isBrandPath('/our-impact')).toBe(true);
    expect(isBrandPath('/sv/our-impact')).toBe(true);
    expect(isBrandPath('/products')).toBe(false);
    expect(isBrandPath('/ar/products/some-product')).toBe(false);
    expect(isBrandPath('/de/cart')).toBe(false);
    expect(isBrandPath('/checkout')).toBe(false);
    expect(isBrandPath('/(checkout)/checkout')).toBe(false);
    expect(isBrandPath('/collections/a/b?sort=new#top')).toBe(false);
    expect(isBrandPath('/legal/privacy')).toBe(false);
  });
  it('drops only ONE locale and the internal store prefix', () => {
    // A page whose slug equals a locale code after the locale prefix.
    expect(isBrandPath('/ar/en')).toBe(true);
    expect(isBrandPath('/store/demo')).toBe(true);
    expect(isBrandPath('/store/demo/ar/account')).toBe(false);
    expect(isBrandPath('/store/demo/products')).toBe(false);
  });
});

describe('section keys', () => {
  it('lists the eight creative sections', () => {
    expect(CREATIVE_SECTION_KEYS).toHaveLength(8);
    expect(new Set(CREATIVE_SECTION_KEYS).size).toBe(8);
  });
});
