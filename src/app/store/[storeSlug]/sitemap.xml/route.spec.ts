import { describe, expect, it, vi } from 'vitest';

// Sitemap data with Swedish and Arabic slugs (stored decoded, NFC).
const sitemapData = {
  locales: ['sv', 'ar'],
  primaryLocale: 'sv',
  home: { lastmod: '2026-10-01T00:00:00.000Z' },
  static_pages: [{ slug: 'om-oss', lastmod: '2026-10-01T00:00:00.000Z' }],
  landing_pages: [{ slug: 'هدية-لأمي', lastmod: '2026-10-01T00:00:00.000Z' }],
  products: [{ slug: 'tröja', lastmod: '2026-10-01T00:00:00.000Z' }],
  collections: [{ slug: 'kläder', path: ['parent', 'kläder'], lastmod: '2026-10-01T00:00:00.000Z' }],
  // A default-template legal page has no modification date.
  legal_pages: [{ slug: 'privacy', lastmod: null }],
};

vi.mock('@/lib/api', () => ({
  storefront: {
    getSitemapData: vi.fn(async () => sitemapData),
    getStore: vi.fn(async () => ({ custom_domain: 'shop.example.com' })),
  },
}));

import { GET } from './route';

async function sitemapXml(): Promise<string> {
  const res = await GET(new Request('https://shop.example.com/sitemap.xml'), {
    params: Promise.resolve({ storeSlug: 'shop' }),
  });
  return res.text();
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

describe('store sitemap.xml slug encoding', () => {
  it('percent-encodes non-ASCII slugs in <loc>', async () => {
    const xml = await sitemapXml();
    expect(locs(xml)).toEqual(
      expect.arrayContaining([
        'https://shop.example.com/om-oss',
        `https://shop.example.com/${encodeURIComponent('هدية-لأمي').toLowerCase()}`,
        'https://shop.example.com/products/tr%c3%b6ja',
        'https://shop.example.com/collections/parent/kl%c3%a4der',
      ]),
    );
  });

  it('emits no raw non-ASCII characters in any URL', async () => {
    const xml = await sitemapXml();
    const hrefs = [...locs(xml), ...[...xml.matchAll(/href="([^"]*)"/g)].map((m) => m[1])];
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^[\x21-\x7e]+$/);
  });

  it('encodes the hreflang alternates the same way', async () => {
    const xml = await sitemapXml();
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="ar" href="https://shop.example.com/ar/collections/parent/kl%c3%a4der" />',
    );
  });
});

describe('store sitemap.xml legal pages', () => {
  it('lists a legal page with a null lastmod without a <lastmod> tag', async () => {
    const xml = await sitemapXml();
    const entry = xml
      .split('<url>')
      .find((chunk) => chunk.includes('<loc>https://shop.example.com/legal/privacy</loc>'));
    expect(entry).toBeDefined();
    expect(entry).not.toContain('<lastmod>');
    expect(xml).not.toContain('Invalid');
  });
});
