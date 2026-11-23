import { describe, expect, it } from 'vitest';
import { PRODUCT_REF_FALLBACK, pickKeyFromUrl, picked, pickedHref, pickedKeys, pickedSlugs, productSlugFromUrl } from './pickedProducts';

// M165: pick fields accept `product:<id>` references next to typed urls.

const ID = '0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const REF = `product:${ID}`;

describe('pickKeyFromUrl', () => {
  it('typed slug, reference (lowercase, tail dropped), anything else null', () => {
    expect(pickKeyFromUrl('/sv/products/blue-stone?x=1')).toBe('blue-stone');
    expect(pickKeyFromUrl(`PRODUCT:${ID.toUpperCase()}?variant=2`)).toBe(REF);
    expect(pickKeyFromUrl('product:abc')).toBeNull();
    expect(pickKeyFromUrl(`collection:${ID}`)).toBeNull();
    expect(pickKeyFromUrl(4)).toBeNull();
    expect(productSlugFromUrl(REF)).toBeNull();
  });
});

describe('pickedKeys', () => {
  it('reads settings and translated content rows, slugs and references together', () => {
    expect(pickedKeys('cover-hero', { detail_url: REF }, {})).toEqual([REF]);
    expect(pickedKeys('object-study', { product_url: '/products/a' }, {})).toEqual(['a']);
    expect(pickedKeys('look-spread', {}, { items: [{ url: REF }, { url: '/products/b' }, { url: REF }] })).toEqual([REF, 'b']);
    expect(pickedKeys('look-spread', { items: [{ url: REF }] }, {})).toEqual([REF]);
    expect(pickedKeys('hero-slider', { cta_url: REF }, {})).toEqual([]);
    expect(pickedSlugs('look-spread', {}, { items: [{ url: REF }, { url: '/products/b' }] })).toEqual(['b']);
  });
});

describe('picked / pickedHref', () => {
  const live = { slug: 'x', title: 'Sign', url: '/products/skylt' };
  const preloaded = { products: { [REF]: live } };

  it('finds a preloaded reference', () => {
    expect(picked(preloaded, REF)).toBe(live);
    expect(picked(preloaded, `${REF}#reviews`)).toBe(live);
    expect(picked(preloaded, '/products/x')).toBeNull();
  });

  it('a reference links its live canonical path plus tail, else the product list', () => {
    expect(pickedHref(`${REF}#reviews`, live)).toBe('/products/skylt#reviews');
    expect(pickedHref(REF, null)).toBe(PRODUCT_REF_FALLBACK);
    // Typed urls behave as before.
    expect(pickedHref('/products/typed', null)).toBe('/products/typed');
  });
});
