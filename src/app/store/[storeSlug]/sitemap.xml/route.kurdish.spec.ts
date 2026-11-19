import { describe, expect, it, vi } from 'vitest';

// A store that enabled Kurmanji ('ku') while it is in review: the sitemap
// lists and advertises only its public locales.
const legacyData = {
  locales: ['sv', 'en', 'ku'],
  primaryLocale: 'sv',
  home: { lastmod: '2026-11-01T00:00:00.000Z' },
  static_pages: [{ slug: 'om-oss', lastmod: '2026-11-01T00:00:00.000Z' }],
  landing_pages: [],
  products: [{ slug: 'jumper', lastmod: '2026-11-01T00:00:00.000Z' }],
  collections: [],
  legal_pages: [],
};

const market = {
  key: 'se',
  name: 'Sweden',
  default_locale: 'sv',
  locales: ['en', 'ku'],
  countries: ['SE'],
  currency: 'SEK',
  is_default: true,
  primary_hostname: 'shop.example.com',
  status: 'LIVE',
};

const getSitemapData = vi.fn(async (): Promise<unknown> => legacyData);

vi.mock('@/lib/api', () => ({
  storefront: {
    getSitemapData: (...args: unknown[]) => getSitemapData(...(args as [])),
    getStore: vi.fn(async () => ({ custom_domain: 'shop.example.com' })),
  },
}));

import { GET } from './route';

async function sitemapXml(headers: Record<string, string> = {}): Promise<string> {
  const res = await GET(new Request('https://shop.example.com/sitemap.xml', { headers }), {
    params: Promise.resolve({ storeSlug: 'shop' }),
  });
  return res.text();
}

describe('store sitemap.xml with a locale in review', () => {
  it('legacy store: no /ku/ URL and no ku hreflang, the other locales unchanged', async () => {
    getSitemapData.mockResolvedValueOnce(legacyData);
    const xml = await sitemapXml();
    expect(xml).not.toContain('/ku');
    expect(xml).not.toContain('hreflang="ku"');
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://shop.example.com/en/om-oss" />');
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="sv" href="https://shop.example.com/om-oss" />');
  });

  it('market store: no ku <url> entry and no ku alternate', async () => {
    getSitemapData.mockResolvedValueOnce({ ...legacyData, market, markets: [market] });
    const xml = await sitemapXml({ 'x-market': 'se' });
    expect(xml).toContain('<loc>https://shop.example.com/products/jumper</loc>');
    expect(xml).toContain('<loc>https://shop.example.com/en/products/jumper</loc>');
    expect(xml).not.toContain('/ku');
    expect(xml).not.toMatch(/hreflang="ku/);
  });
});
