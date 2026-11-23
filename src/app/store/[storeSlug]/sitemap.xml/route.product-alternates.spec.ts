import { describe, expect, it, vi } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from '@/lib/localePaths.fixtures';

// M161 A: the market sitemap's product alternates equal the product page's
// (`productAlternates`, the same helper and the same slugs). The API sends
// the slug of every translation, so each market finds its own slug.

const slugs = {
  sv: 'studentskylt-med-guldtext',
  en: 'student-sign-with-gold-text',
  de: 'abschlussschild-mit-goldschrift',
};

const data = {
  locales: ['en', 'de'],
  primaryLocale: 'en',
  home: null,
  static_pages: [],
  landing_pages: [],
  products: [{ slug: slugs.en, slugs, lastmod: '2026-11-01T00:00:00.000Z' }],
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
import { productAlternates } from '@/lib/productPaths';

async function sitemapXml(host: string, marketKey: string): Promise<string> {
  const res = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { 'x-market': marketKey } }), {
    params: Promise.resolve({ storeSlug: 'namez-se' }),
  });
  return res.text();
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!);

function entryAlternates(xml: string, loc: string): Record<string, string> {
  const block = xml.split('<url>').find((b) => b.includes(`<loc>${loc}</loc>`)) ?? '';
  return Object.fromEntries([...block.matchAll(/hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

const translations = Object.entries(slugs).map(([locale, slug]) => ({ locale, slug }));

describe('market sitemap product alternates (M161 A)', () => {
  it('namez.shop: every market slot gets its own translated slug', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_EU, markets: [NAMEZ_SE, NAMEZ_EU] });
    const xml = await sitemapXml('namez.shop', 'eu');
    const alt = entryAlternates(xml, `https://namez.shop/products/${slugs.en}`);
    expect(alt['sv-SE']).toBe(`https://namez.se/products/${slugs.sv}`);
    expect(alt.en).toBe(`https://namez.shop/products/${slugs.en}`);
    expect(alt['de-DE']).toBe(`https://namez.shop/de-de/products/${slugs.de}`);
    expect(alt.de).toBe(`https://namez.shop/de-de/products/${slugs.de}`);
    expect(alt['de-AT']).toBe(`https://namez.shop/de-at/products/${slugs.de}`);
    expect(alt['x-default']).toBe(`https://namez.shop/products/${slugs.en}`);
    // The de slots list the German slug as their own <loc>.
    expect(locs(xml)).toContain(`https://namez.shop/de-at/products/${slugs.de}`);
  });

  it('namez.se: the en / de alternates carry the en / de slugs', async () => {
    getSitemapData.mockResolvedValueOnce({
      ...data,
      locales: ['sv'],
      primaryLocale: 'sv',
      products: [{ slug: slugs.sv, slugs, lastmod: '2026-11-01T00:00:00.000Z' }],
      market: NAMEZ_SE,
      markets: [NAMEZ_SE, NAMEZ_EU],
    });
    const xml = await sitemapXml('namez.se', 'default');
    const alt = entryAlternates(xml, `https://namez.se/products/${slugs.sv}`);
    expect(alt['sv-SE']).toBe(`https://namez.se/products/${slugs.sv}`);
    expect(alt.en).toBe(`https://namez.shop/products/${slugs.en}`);
    expect(alt['de-DE']).toBe(`https://namez.shop/de-de/products/${slugs.de}`);
    expect(alt['de-AT']).toBe(`https://namez.shop/de-at/products/${slugs.de}`);
    expect(alt['x-default']).toBe(`https://namez.shop/products/${slugs.en}`);
  });

  it('parity: every sitemap entry equals the page alternates of that URL', async () => {
    getSitemapData.mockResolvedValueOnce({ ...data, market: NAMEZ_EU, markets: [NAMEZ_SE, NAMEZ_EU] });
    const xml = await sitemapXml('namez.shop', 'eu');
    const store = {
      custom_domain: null,
      language_config: { primary_locale: 'en', secondary_locales: NAMEZ_EU.locales },
      market: NAMEZ_EU,
      markets: [NAMEZ_SE, NAMEZ_EU],
    };
    const cases: { loc: string; locale: string; pathPrefix: string; requested: string }[] = [
      { loc: `https://namez.shop/products/${slugs.en}`, locale: 'en', pathPrefix: '', requested: slugs.en },
      // A request for the English slug under /de-at gets the German canonical.
      { loc: `https://namez.shop/de-at/products/${slugs.de}`, locale: 'de', pathPrefix: '/de-at', requested: slugs.en },
      { loc: `https://namez.shop/de-de/products/${slugs.de}`, locale: 'de', pathPrefix: '/de-de', requested: slugs.de },
    ];
    for (const c of cases) {
      const page = productAlternates({
        storeSlug: 'namez-se',
        store,
        translations,
        slug: c.requested,
        locale: c.locale,
        pathPrefix: c.pathPrefix,
      });
      expect(page.canonical).toBe(c.loc);
      expect(entryAlternates(xml, c.loc)).toEqual(page.languages);
    }
  });
});
