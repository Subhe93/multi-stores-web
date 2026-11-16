import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focused storefront (src/lib/focusedStorefront.ts): the sitemap lists only
// what is not redirected to the external site, i.e. product pages. A store
// with a site but without the flag keeps the full sitemap.

const sitemapData = {
  locales: ['sv', 'en'],
  primaryLocale: 'sv',
  home: { lastmod: '2026-10-01T00:00:00.000Z' },
  static_pages: [{ slug: 'om-oss', lastmod: '2026-10-01T00:00:00.000Z' }],
  landing_pages: [{ slug: 'kampanj', lastmod: '2026-10-01T00:00:00.000Z' }],
  products: [
    { slug: 'sommarkurs', lastmod: '2026-10-01T00:00:00.000Z' },
    { slug: 'vinterkurs', lastmod: '2026-10-01T00:00:00.000Z' },
  ],
  collections: [{ slug: 'kurser', path: ['kurser'], lastmod: '2026-10-01T00:00:00.000Z' }],
  legal_pages: [{ slug: 'privacy', lastmod: null }],
};

const store = { current: {} as Record<string, unknown> };

vi.mock('@/lib/api', () => ({
  storefront: {
    getSitemapData: vi.fn(async () => sitemapData),
    getStore: vi.fn(async () => store.current),
  },
}));

import { GET } from './route';

const SITE = 'https://mollstrands.example/';

async function sitemapUrls(host = 'shop.example.com'): Promise<string[]> {
  const res = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { host } }), {
    params: Promise.resolve({ storeSlug: 'shop' }),
  });
  const xml = await res.text();
  return [
    ...[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!),
    ...[...xml.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!),
  ];
}

beforeEach(() => {
  store.current = { custom_domain: 'shop.example.com' };
});

describe('store sitemap.xml in a focused storefront', () => {
  it('lists product pages only, never a redirected URL', async () => {
    store.current = {
      custom_domain: 'shop.example.com',
      checkout: { external_site_url: SITE, external_focus: true },
    };
    const urls = await sitemapUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/shop\.example\.com\/(en\/)?products\/(sommarkurs|vinterkurs)$/);
    }
    expect(new Set(urls)).toEqual(
      new Set([
        'https://shop.example.com/products/sommarkurs',
        'https://shop.example.com/en/products/sommarkurs',
        'https://shop.example.com/products/vinterkurs',
        'https://shop.example.com/en/products/vinterkurs',
      ]),
    );
  });

  it('a store with a site but without the flag keeps the full sitemap', async () => {
    const plain = await sitemapUrls();
    store.current = { custom_domain: 'shop.example.com', checkout: { external_site_url: SITE } };
    const withSite = await sitemapUrls();
    expect(withSite).toEqual(plain);
    expect(withSite).toEqual(
      expect.arrayContaining([
        'https://shop.example.com',
        'https://shop.example.com/om-oss',
        'https://shop.example.com/kampanj',
        'https://shop.example.com/collections/kurser',
        'https://shop.example.com/legal/privacy',
        'https://shop.example.com/products',
        'https://shop.example.com/products/sommarkurs',
      ]),
    );
  });

  it('the external site being the host served: the full sitemap (mode not in force)', async () => {
    store.current = {
      custom_domain: 'shop.example.com',
      checkout: { external_site_url: SITE, external_focus: true },
    };
    const urls = await sitemapUrls('mollstrands.example');
    expect(urls).toEqual(expect.arrayContaining(['https://shop.example.com/products', 'https://shop.example.com/om-oss']));
  });
});
