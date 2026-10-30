import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProducts = vi.fn();
vi.mock('./api', () => ({ storefront: { getProducts: (...args: unknown[]) => getProducts(...args) } }));

import {
  collectionProductsParams,
  featuredProductsLimit,
  featuredProductsParams,
  preloadSectionData,
} from './preloadSections';
import type { SectionInstance } from '@/themes/types';

const COLLECTION_ID = '0b5c3f7e-2a41-4c8e-9d0a-1f2e3d4c5b6a';

function section(id: string, section_key: string, settings: Record<string, unknown>, is_hidden = false): SectionInstance {
  return { id, section_key, settings, is_hidden, sort_order: 0, translations: [] } as unknown as SectionInstance;
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

describe('param builders', () => {
  it('collection-products without a category lists all products', () => {
    expect(collectionProductsParams({ locale: 'sv', limit: 6, category: '' })).toEqual({ locale: 'sv', limit: '6' });
  });

  it('featured-products adds featured=true only for the featured filter', () => {
    expect(featuredProductsParams({ locale: 'sv', limit: 4, filter: 'newest' })).toEqual({ locale: 'sv', limit: '4' });
    expect(featuredProductsParams({ locale: 'sv', limit: 4, filter: 'featured' })).toEqual({
      locale: 'sv',
      limit: '4',
      featured: 'true',
    });
  });

  it('featured-products limit defaults to 4 and clamps to 1..12', () => {
    expect(featuredProductsLimit({})).toBe(4);
    expect(featuredProductsLimit({ limit: 50 })).toBe(12);
    expect(featuredProductsLimit({ limit: 0 })).toBe(1);
    expect(featuredProductsLimit({ limit: 'x' })).toBe(4);
  });
});

describe('preloadSectionData', () => {
  beforeEach(() => {
    getProducts.mockReset();
    getProducts.mockImplementation(async (_slug: string, params: Record<string, string>) => rows(Number(params.limit) + 2));
  });

  it('preloads collection-products with and without a category, and featured-products', async () => {
    const out = await preloadSectionData(
      'namez-se',
      [
        section('a', 'collection-products', { limit: 1 }),
        section('b', 'collection-products', { limit: 6, category: COLLECTION_ID }),
        section('c', 'featured-products', { limit: 4, filter: 'newest' }),
        section('d', 'featured-products', { limit: 3, filter: 'featured' }),
        section('e', 'hero-banner', {}),
      ],
      { locale: 'sv', marketRef: { key: 'se' } },
    );

    expect(getProducts).toHaveBeenCalledTimes(4);
    expect(getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', limit: '1' }, { key: 'se' });
    expect(getProducts).toHaveBeenCalledWith(
      'namez-se',
      { locale: 'sv', limit: '6', creator_category_id: COLLECTION_ID },
      { key: 'se' },
    );
    expect(getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', limit: '4' }, { key: 'se' });
    expect(getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', limit: '3', featured: 'true' }, { key: 'se' });
    // Lists are trimmed to the section limit, like the client does.
    expect((out.a as unknown[]).length).toBe(1);
    expect((out.b as unknown[]).length).toBe(6);
    expect((out.c as unknown[]).length).toBe(4);
    expect((out.d as unknown[]).length).toBe(3);
    expect(out.e).toBeUndefined();
  });

  it('skips hidden sections and omits failed requests', async () => {
    getProducts.mockImplementation(async (_slug: string, params: Record<string, string>) => {
      if (params.featured) throw new Error('boom');
      return rows(2);
    });
    const out = await preloadSectionData(
      'namez-se',
      [
        section('hidden', 'featured-products', {}, true),
        section('ok', 'featured-products', { limit: 2 }),
        section('fail', 'featured-products', { filter: 'featured' }),
      ],
      { locale: 'sv' },
    );
    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', limit: '2' }, undefined);
    expect(Object.keys(out)).toEqual(['ok']);
  });

  it('returns an empty map without fetching when no section preloads', async () => {
    expect(await preloadSectionData('s', [section('x', 'rich-text', {})], { locale: 'en' })).toEqual({});
    expect(getProducts).not.toHaveBeenCalled();
  });
});
