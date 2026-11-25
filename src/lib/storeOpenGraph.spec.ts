import { describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import { buildStoreOpenGraph, ogFallbackImage, ogImageUrl, ogLocale, requestCountry } from './storeOpenGraph';

describe('ogLocale / requestCountry (M161 C)', () => {
  it('locale-path slot country wins', () => {
    expect(ogLocale('de', requestCountry(NAMEZ_EU, '/de-at'))).toBe('de_AT');
    expect(ogLocale('de', requestCountry(NAMEZ_EU, '/de-de'))).toBe('de_DE');
  });

  it('a one-country market gives its country', () => {
    expect(requestCountry(NAMEZ_SE, undefined)).toBe('SE');
    expect(ogLocale('sv', requestCountry(NAMEZ_SE, undefined))).toBe('sv_SE');
  });

  it('a multi-country market root falls back to the language default', () => {
    expect(requestCountry(NAMEZ_EU, '')).toBeNull();
    expect(ogLocale('en', requestCountry(NAMEZ_EU, ''))).toBe('en_US');
    // A bare folder has no country either.
    expect(ogLocale('ar', requestCountry(NAMEZ_EU, '/ar'))).toBe('ar_AR');
  });

  it('no market: language default; unknown language: undefined', () => {
    expect(requestCountry(null, undefined)).toBeNull();
    expect(ogLocale('sv', null)).toBe('sv_SE');
    expect(ogLocale('ku', null)).toBeUndefined();
    expect(ogLocale(undefined, 'SE')).toBeUndefined();
  });
});

describe('buildStoreOpenGraph', () => {
  const resolve = (u: string) => `https://api.example.com${u}`;

  it('url = canonical, locale and own image first', () => {
    const og = buildStoreOpenGraph({
      title: 'T',
      description: 'D',
      url: 'https://namez.shop/de-at/products/x',
      image: 'https://cdn/x.webp',
      fallbackImage: ogFallbackImage({ logo_url: '/uploads/logo.webp' }, resolve),
      locale: 'de',
      country: 'AT',
    });
    expect(og).toEqual({
      title: 'T',
      description: 'D',
      url: 'https://namez.shop/de-at/products/x',
      images: ['https://cdn/x.webp'],
      locale: 'de_AT',
      type: 'website',
    });
  });

  it('falls back to the store logo, else no image', () => {
    const logo = ogFallbackImage({ logo_url: '/uploads/logo.webp' }, resolve);
    expect(buildStoreOpenGraph({ image: null, fallbackImage: logo }).images).toEqual([
      'https://api.example.com/uploads/logo.webp',
    ]);
    expect(buildStoreOpenGraph({ fallbackImage: ogFallbackImage({ logo_url: null }, resolve) }).images).toBeUndefined();
    expect(ogFallbackImage(undefined, resolve)).toBeUndefined();
  });
});

describe('buildStoreOpenGraph image alt (M170 A)', () => {
  const base = {
    title: 'T',
    url: 'https://namez.shop/de-de/products/x',
    image: 'https://cdn/x.webp',
    fallbackImage: 'https://cdn/logo.webp',
    locale: 'de',
    country: 'DE',
  };

  it('no alt: the output is deep-equal to the one without the key', () => {
    const before = buildStoreOpenGraph(base);
    expect(before.images).toEqual(['https://cdn/x.webp']);
    for (const imageAlt of [undefined, null, '', '   ']) {
      expect(buildStoreOpenGraph({ ...base, imageAlt })).toEqual(before);
    }
  });

  it('an alt of the route image gives the object form', () => {
    const og = buildStoreOpenGraph({ ...base, imageAlt: ' Rotes Dalapferd aus Holz ' });
    expect(og.images).toEqual([{ url: 'https://cdn/x.webp', alt: 'Rotes Dalapferd aus Holz' }]);
    expect(ogImageUrl(og.images?.[0])).toBe('https://cdn/x.webp');
    // Nothing else changes.
    expect({ ...og, images: undefined }).toEqual({ ...buildStoreOpenGraph(base), images: undefined });
  });

  it('a product alt is never attached to the store-logo fallback', () => {
    for (const image of [undefined, null, '']) {
      const og = buildStoreOpenGraph({ ...base, image, imageAlt: 'Rotes Dalapferd' });
      expect(og.images).toEqual(['https://cdn/logo.webp']);
    }
    expect(buildStoreOpenGraph({ title: 'T', imageAlt: 'Rotes Dalapferd' }).images).toBeUndefined();
  });

  it('ogImageUrl reads both forms', () => {
    expect(ogImageUrl('https://cdn/x.webp')).toBe('https://cdn/x.webp');
    expect(ogImageUrl({ url: 'https://cdn/x.webp', alt: 'A' })).toBe('https://cdn/x.webp');
    expect(ogImageUrl(undefined)).toBeUndefined();
  });
});
