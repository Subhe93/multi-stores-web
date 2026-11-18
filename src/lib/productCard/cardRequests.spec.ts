import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storefront } from '@/lib/api';
import { listingProjector, toListingCard, toListingProduct, type StorefrontProductRow } from '@/lib/listing';
import { cardQuery, resolveProductCard } from './settings';

// Product card wiring: what a request gains with card settings, and that
// nothing moves without them (URL and projection).

let urls: string[];

beforeEach(() => {
  urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { items: [], total: 0, page: 1, limit: 60, has_more: false } }),
      } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const path = (u: string) => u.replace(/^.*\/storefront/, '');
const SETTINGS = resolveProductCard({});

describe('paged list URL', () => {
  it('writes card after limit and before the market suffix', async () => {
    await storefront.getProductsPage(
      'demo',
      { card: '1', limit: 60, page: 2, sort: 'newest', search: 'mugg', creator_category: 'kok', locale: 'sv' },
      { key: 'no', preview: true },
    );
    expect(path(urls[0])).toBe(
      '/demo/products?locale=sv&creator_category=kok&search=mugg&sort=newest&page=2&limit=60&card=1&market=no&preview=1',
    );
  });

  it('is unchanged without card settings', async () => {
    await storefront.getProductsPage('demo', { locale: 'sv', page: 1, limit: 60, ...cardQuery(null) }, 'se');
    expect(path(urls[0])).toBe('/demo/products?locale=sv&page=1&limit=60&market=se');
  });
});

describe('full list URL', () => {
  it('gains card=1 as the last key with settings, nothing without', async () => {
    await storefront.getProducts('demo', { locale: 'sv', limit: '8', ...cardQuery(SETTINGS) }, 'se');
    await storefront.getProducts('demo', { locale: 'sv', limit: '8', ...cardQuery(null) }, 'se');
    expect(path(urls[0])).toBe('/demo/products?locale=sv&limit=8&card=1&market=se');
    expect(path(urls[1])).toBe('/demo/products?locale=sv&limit=8&market=se');
  });
});

describe('listingProjector', () => {
  const row = {
    id: 'p1',
    base_price: '74',
    compare_at_price: '89',
    tax_rate_bp: 2500,
    translations: [{ locale: 'en', title: 'Hoodie', slug: 'hoodie', description: '<p>long</p>' }],
    images: [{ url: '/a.webp' }, { url: '/b.webp' }],
    track_inventory: true,
    stock_quantity: 2,
    variants: [],
  } as unknown as StorefrontProductRow;

  it('without settings is exactly the plain projection (no card key)', () => {
    expect(listingProjector(false)(row)).toEqual(toListingProduct(row));
    expect(listingProjector(false, toListingCard)(row)).toEqual(toListingCard(row));
    expect(listingProjector(false)(row)).not.toHaveProperty('card');
    // Usable as a map callback: the index is not taken for an argument.
    expect([row].map(listingProjector(false))).toEqual([toListingProduct(row)]);
  });

  it('with settings attaches the card model and keeps the projection', () => {
    const out = listingProjector(true, toListingCard)(row);
    const { card, ...rest } = out;
    expect(rest).toEqual(toListingCard(row));
    // The projection keeps one image; the second one lives in the model.
    expect(out.images).toHaveLength(1);
    expect(card?.second_image).toBe('/b.webp');
    expect(card?.has_variants).toBe(false);
  });
});
