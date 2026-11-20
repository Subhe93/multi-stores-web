import { describe, expect, it, vi } from 'vitest';

// Configurable x-default market: the market sitemap must name the same
// x-default target as the pages' hreflang (both go through
// buildStoreAlternates), on every market's sitemap.
const data = {
  locales: ['sv', 'en'],
  primaryLocale: 'sv',
  home: { lastmod: '2026-11-01T00:00:00.000Z' },
  static_pages: [],
  landing_pages: [],
  products: [{ slug: 'metallkort', slugs: { sv: 'metallkort', en: 'metal-card' }, lastmod: '2026-11-01T00:00:00.000Z' }],
  collections: [],
  legal_pages: [],
};

const se = {
  key: 'se',
  name: 'Sweden',
  default_locale: 'sv',
  locales: ['en', 'ar'],
  countries: ['SE'],
  currency: 'SEK',
  is_default: true,
  primary_hostname: 'namez.se',
  status: 'LIVE',
};

const eu = {
  key: 'eu',
  name: 'EU',
  default_locale: 'en',
  locales: ['de', 'fr', 'ar'],
  countries: ['DE', 'FR', 'AT'],
  currency: 'EUR',
  is_default: false,
  primary_hostname: 'namez.shop',
  status: 'LIVE',
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

async function sitemapXml(host: string, marketKey: string): Promise<string> {
  const res = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { 'x-market': marketKey } }), {
    params: Promise.resolve({ storeSlug: 'namez-se' }),
  });
  return res.text();
}

const xDefaults = (xml: string) =>
  [...xml.matchAll(/hreflang="x-default" href="([^"]*)"/g)].map((m) => m[1]);

describe('store sitemap.xml x-default market', () => {
  it('unset: every entry points x-default at the default market', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: se, markets: [se, eu] });
    const xml = await sitemapXml('namez.se', 'se');
    const targets = new Set(xDefaults(xml));
    expect(targets.has('https://namez.se/products/metallkort')).toBe(true);
    for (const t of targets) expect(t.startsWith('https://namez.se')).toBe(true);
  });

  it('flagged eu: both markets\' sitemaps point x-default at namez.shop, in its default locale and slug', async () => {
    const euX = { ...eu, is_x_default: true };
    for (const [host, market] of [
      ['namez.se', se],
      ['namez.shop', euX],
    ] as const) {
      getSitemapData.mockResolvedValueOnce({ ...data, market, markets: [se, euX] });
      const xml = await sitemapXml(host, market.key);
      const targets = new Set(xDefaults(xml));
      expect(targets.has('https://namez.shop/products/metal-card')).toBe(true);
      expect(targets.has('https://namez.shop')).toBe(true);
      for (const t of targets) expect(t.startsWith('https://namez.shop')).toBe(true);
    }
  });

  it('agrees with the page hreflang for the same product', async () => {
    const euX = { ...eu, is_x_default: true };
    getSitemapData.mockResolvedValueOnce({ ...data, market: se, markets: [se, euX] });
    const xml = await sitemapXml('namez.se', 'se');
    const page = buildStoreAlternates({
      origin: 'https://namez.se',
      locale: 'sv',
      primaryLocale: 'sv',
      secondaryLocales: se.locales,
      path: '/products/metallkort',
      markets: [se, euX],
      storeSlug: 'namez-se',
      pathByLocale: { sv: '/products/metallkort', en: '/products/metal-card' },
    });
    expect(xml).toContain(`hreflang="x-default" href="${page.languages['x-default']}"`);
  });

  it('flagged but not indexable (NEVER): falls back to the default market', async () => {
    const euNever = { ...eu, is_x_default: true, indexing: 'NEVER' };
    getSitemapData.mockResolvedValueOnce({ ...data, market: se, markets: [se, euNever] });
    const xml = await sitemapXml('namez.se', 'se');
    for (const t of new Set(xDefaults(xml))) expect(t.startsWith('https://namez.se')).toBe(true);
  });
});
