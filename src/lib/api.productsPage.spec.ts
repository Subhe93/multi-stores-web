import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storefront, toProductsPage } from './api';

// Paged product list helper (opt-in pagination contract).

let urls: string[];
let answer: unknown;

beforeEach(() => {
  urls = [];
  answer = { items: [], total: 0, page: 1, limit: 24, has_more: false };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => ({ data: answer }) } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const path = (u: string) => u.replace(/^.*\/storefront/, '');

describe('storefront.getProductsPage URL', () => {
  it('writes the keys in a fixed order whatever the input order', async () => {
    await storefront.getProductsPage('namez-se', {
      limit: 60,
      page: 2,
      sort: 'price_desc',
      search: 'mugg',
      creator_category_id: 'abc',
      creator_category: 'kok',
      locale: 'sv',
    });
    expect(path(urls[0])).toBe(
      '/namez-se/products?locale=sv&creator_category=kok&creator_category_id=abc&search=mugg&sort=price_desc&page=2&limit=60',
    );
  });

  it('omits empty optional filters', async () => {
    await storefront.getProductsPage('namez-se', { locale: 'ar', page: 1, limit: 1, search: '' });
    expect(path(urls[0])).toBe('/namez-se/products?locale=ar&page=1&limit=1');
  });

  it('appends the market (and preview) suffix', async () => {
    await storefront.getProductsPage('namez-se', { locale: 'sv', page: 1, limit: 1 }, 'se');
    await storefront.getProductsPage('namez-se', { locale: 'sv', page: 1, limit: 1 }, { key: 'no', preview: true });
    expect(path(urls[0])).toBe('/namez-se/products?locale=sv&page=1&limit=1&market=se');
    expect(path(urls[1])).toBe('/namez-se/products?locale=sv&page=1&limit=1&market=no&preview=1');
  });

  it('encodes free-text search', async () => {
    await storefront.getProductsPage('namez-se', { locale: 'sv', page: 1, limit: 1, search: 'röd & blå' });
    expect(path(urls[0])).toBe('/namez-se/products?locale=sv&search=r%C3%B6d+%26+bl%C3%A5&page=1&limit=1');
  });

  it('passes a paged answer through', async () => {
    answer = { items: [{ id: 'a' }], total: 61, page: 1, limit: 60, has_more: true };
    await expect(storefront.getProductsPage('s', { locale: 'sv', page: 1, limit: 60 })).resolves.toEqual({
      items: [{ id: 'a' }],
      total: 61,
      page: 1,
      limit: 60,
      has_more: true,
      legacy: false,
    });
  });

  it('an array (older API) becomes one complete legacy page', async () => {
    answer = [{ id: 'a' }, { id: 'b' }];
    await expect(storefront.getProductsPage('s', { locale: 'sv', page: 1, limit: 1 })).resolves.toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      total: 2,
      page: 1,
      limit: 2,
      has_more: false,
      legacy: true,
    });
  });

  it('getProducts is unchanged', async () => {
    answer = [];
    await storefront.getProducts('namez-se', { locale: 'sv', limit: '4' }, 'se');
    await storefront.getProducts('namez-se');
    expect(path(urls[0])).toBe('/namez-se/products?locale=sv&limit=4&market=se');
    expect(path(urls[1])).toBe('/namez-se/products');
  });
});

describe('toProductsPage', () => {
  it('throws on any other shape', () => {
    for (const bad of [null, undefined, 'x', 3, {}, { items: [] }, { items: {}, total: 1 }, { items: [], total: '1' }]) {
      expect(() => toProductsPage(bad)).toThrow();
    }
  });
});
