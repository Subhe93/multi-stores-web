import { describe, expect, it } from 'vitest';
import {
  accentSize,
  ACCENT_SIZES,
  COMMERCE_SEGMENTS,
  CREATIVE_SECTION_KEYS,
  isBrandPath,
  isBrandSegment,
  routeScope,
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

describe('routeScope', () => {
  it('home and content pages are brand, product lists and pages are shop, the rest is flow', () => {
    expect(routeScope(null)).toBe('brand');
    expect(routeScope('our-impact')).toBe('brand');
    expect(routeScope('products')).toBe('shop');
    expect(routeScope('collections')).toBe('shop');
    for (const s of ['cart', 'checkout', '(checkout)', 'account', 'auth', 'legal', 'market-not-found']) {
      expect(routeScope(s), s).toBe('flow');
    }
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
  it('the engine adds the three heroes, the stage scenes, the four scroll sections, the ornament divider and the seven brand sections', () => {
    expect([...CREATIVE_SECTION_KEYS]).toEqual([
      'hero-outline',
      'hero-sunrise',
      'hero-dawn',
      'stage-scenes',
      'story-pinned',
      'sticky-steps',
      'motion-path',
      'marquee-band',
      'ornament-line',
      'cover-hero',
      'look-spread',
      'object-study',
      'script-manifesto',
      'impact-arc',
      'pattern-band',
      'promise-band',
    ]);
  });
});
