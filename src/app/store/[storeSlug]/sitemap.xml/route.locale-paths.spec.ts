import { describe, expect, it, vi } from 'vitest';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from '@/lib/localePaths.fixtures';

// M156 §6.3: the market sitemap lists one <url> per URL root of the market
// (root + every active language-country path), and each entry's
// xhtml:link set equals the page hreflang (same helper).

const data = {
  locales: ['sv', 'en'],
  primaryLocale: 'sv',
  home: null,
  static_pages: [],
  landing_pages: [],
  products: [{ slug: 'x', lastmod: '2026-11-01T00:00:00.000Z' }],
  collections: [],
  legal_pages: [],
};

const getSitemapData = vi.fn(async (): Promise<unknown> => data);

vi.mock('@/lib/api', () => ({
  storefront: {
    getSitemapData: (...args: unknown[]) => getSitemapData(...(args as [])),
    getStore: vi.fn(async () => ({ custom_domain: null })),
  },
}));

import { GET } from './route';
import { buildStoreAlternates } from '@/lib/storeUrl';

async function sitemapXml(host: string, marketKey: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { 'x-market': marketKey, ...headers } }), {
    params: Promise.resolve({ storeSlug: 'namez-se' }),
  });
  return res.text();
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

function entryAlternates(xml: string, loc: string): Record<string, string> {
  const block = xml.split('<url>').find((b) => b.includes(`<loc>${loc}</loc>`)) ?? '';
  return Object.fromEntries([...block.matchAll(/hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

describe('market sitemap with locale paths', () => {
  it('namez.shop: 6 <url> entries per product, each with the page alternates', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_EU, markets: [NAMEZ_SE, NAMEZ_EU] });
    const xml = await sitemapXml('namez.shop', 'eu');
    expect(locs(xml).filter((l) => l!.includes('/products/x'))).toEqual([
      'https://namez.shop/products/x',
      'https://namez.shop/de-de/products/x',
      'https://namez.shop/de-at/products/x',
      'https://namez.shop/fr-fr/products/x',
      'https://namez.shop/fr-be/products/x',
      'https://namez.shop/ar/products/x',
    ]);
    const page = buildStoreAlternates({
      origin: 'https://namez.shop',
      locale: 'de',
      primaryLocale: 'en',
      secondaryLocales: NAMEZ_EU.locales,
      path: '/products/x',
      markets: [NAMEZ_SE, NAMEZ_EU],
      market: NAMEZ_EU,
      storeSlug: 'namez-se',
      pathPrefix: '/de-at',
    });
    for (const loc of locs(xml).filter((l) => l!.includes('/products/x'))) {
      expect(entryAlternates(xml, loc!)).toEqual(page.languages);
    }
    expect(Object.keys(page.languages)).toHaveLength(12);
    expect(xml).not.toContain('/nl-');
  });

  it('namez.se keeps its 3 <loc>s per page; its alternates carry the namez.shop paths', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_SE, markets: [NAMEZ_SE, NAMEZ_EU] });
    const xml = await sitemapXml('namez.se', 'default');
    expect(locs(xml).filter((l) => l!.includes('/products/x'))).toEqual([
      'https://namez.se/products/x',
      'https://namez.se/en/products/x',
      'https://namez.se/ar/products/x',
    ]);
    const alt = entryAlternates(xml, 'https://namez.se/products/x');
    expect(alt['de-AT']).toBe('https://namez.shop/de-at/products/x');
    expect(alt.de).toBe('https://namez.shop/de-de/products/x');
  });

  it('regression: the same market without locale paths lists its locales as before', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_EU_LEGACY, markets: [NAMEZ_SE, NAMEZ_EU_LEGACY] });
    const xml = await sitemapXml('namez.shop', 'eu');
    expect(locs(xml).filter((l) => l!.includes('/products/x'))).toEqual([
      'https://namez.shop/products/x',
      'https://namez.shop/de/products/x',
      'https://namez.shop/fr/products/x',
      'https://namez.shop/ar/products/x',
    ]);
  });

  it('noindex market: empty urlset', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_EU, markets: [NAMEZ_SE, NAMEZ_EU] });
    const xml = await sitemapXml('namez.shop', 'eu', { 'x-store-noindex': '1' });
    expect(locs(xml)).toEqual([]);
  });
});
