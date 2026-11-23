import { beforeEach, describe, expect, it, vi } from 'vitest';

// M165: picked-product sections whose pick field holds `product:<id>` are
// preloaded through a slug of that product (`refSlug`), keyed by the reference.

const getProduct = vi.fn();
vi.mock('./api', () => ({
  storefront: {
    getProducts: vi.fn(async () => []),
    getProduct: (...args: unknown[]) => getProduct(...args),
  },
}));

import { preloadSectionData } from './preloadSections';
import type { SectionInstance } from '@/themes/types';

const SIGN = '0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const GONE = '9f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const DOOR_SLUG = 'skylt-för-dörr';

const row = (slug: string, title: string) => ({
  base_price: 100,
  translations: [{ locale: 'sv', title, slug }],
  images: [{ url: '/i.jpg', sort_order: 0 }],
});

function section(id: string, section_key: string, settings: Record<string, unknown>, content?: Record<string, unknown>): SectionInstance {
  return { id, section_key, settings, sort_order: 0, translations: content ? [{ locale: 'sv', content }] : [] } as SectionInstance;
}

beforeEach(() => {
  getProduct.mockReset();
  getProduct.mockImplementation(async (_store: string, slug: string) => row(slug, `T ${slug}`));
});

describe('preloadSectionData: product references in pick fields', () => {
  it('a reference is fetched by its slug (non-ASCII works) and keyed by the reference', async () => {
    const refSlug = vi.fn(async (id: string) => (id === SIGN ? DOOR_SLUG : null));
    const out = (await preloadSectionData('anna', [section('c', 'cover-hero', { detail_url: `product:${SIGN.toUpperCase()}#x` })], {
      locale: 'sv',
      refSlug,
    })) as Record<string, { products: Record<string, { url: string; slug: string }> }>;
    expect(refSlug).toHaveBeenCalledWith(SIGN);
    expect(getProduct).toHaveBeenCalledWith('anna', DOOR_SLUG, 'sv', undefined);
    const hit = out.c.products[`product:${SIGN}`];
    expect(hit.url).toBe(`/products/${DOOR_SLUG}`);
  });

  it('unknown reference (null refSlug) or no refSlug: the key is dropped', async () => {
    const out = await preloadSectionData('anna', [section('o', 'object-study', { product_url: `product:${GONE}` })], {
      locale: 'sv',
      refSlug: async () => null,
    });
    expect(out).toEqual({});
    expect(getProduct).not.toHaveBeenCalled();
    expect(await preloadSectionData('anna', [section('o', 'object-study', { product_url: `product:${SIGN}` })], { locale: 'sv' })).toEqual({});
  });

  it('typed slugs and references share the 8-key limit', async () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => ({ url: `/products/p${i}` })),
      ...Array.from({ length: 4 }, (_, i) => ({ url: `product:${i}f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5` })),
    ];
    await preloadSectionData('anna', [section('l', 'look-spread', {}, { items })], {
      locale: 'sv',
      refSlug: async (id) => `slug-${id.slice(0, 1)}`,
    });
    expect(getProduct).toHaveBeenCalledTimes(8);
  });
});
