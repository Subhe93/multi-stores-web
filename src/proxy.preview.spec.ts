import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { parsePreviewLabel, proxy } from './proxy';
import { __resetRedirectCaches } from './lib/redirects';

// Market preview host `<slug>--<key>.<platform host>`: resolved through
// `market-context?market=<key>&preview=1`, routed like a market host (the
// market's default locale unprefixed), flagged `x-market-preview: 1`, never
// crawlable. Everything else keeps today's lookups and headers.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } });
}

const euPreview = {
  key: 'eu',
  name: 'Europe',
  default_locale: 'en',
  locales: ['sv'],
  countries: ['DE', 'FR'],
  currency: 'EUR',
  is_default: false,
  primary_hostname: 'namez.shop',
  status: 'DRAFT',
  preview: true,
};
const defaultMarket = {
  key: 'default',
  name: 'Sweden',
  default_locale: 'sv',
  locales: ['en'],
  countries: ['SE'],
  currency: 'SEK',
  is_default: true,
  primary_hostname: null,
  status: 'LIVE',
};

/** Request headers the proxy forwards to the app (`x-middleware-request-*`). */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe('parsePreviewLabel', () => {
  it('splits exactly one "--" into slug + key', () => {
    expect(parsePreviewLabel('namez-se--eu')).toEqual({ slug: 'namez-se', key: 'eu' });
    expect(parsePreviewLabel('a--b-c')).toEqual({ slug: 'a', key: 'b-c' });
  });
  it('rejects anything ambiguous or malformed', () => {
    expect(parsePreviewLabel('namez-se')).toBeNull();
    expect(parsePreviewLabel('a--b--c')).toBeNull();
    expect(parsePreviewLabel('--eu')).toBeNull();
    expect(parsePreviewLabel('namez--')).toBeNull();
    expect(parsePreviewLabel('namez---eu')).toBeNull();
    expect(parsePreviewLabel('Namez--EU')).toBeNull();
  });
});

describe('proxy market preview host', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  // Unique host per test: the proxy caches host lookups module-wide.
  let n = 0;
  const host = () => `namez-${++n}--eu.localhost:3000`;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function previewOk() {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) {
        return json({ enabled: true, preview: true, market: euPreview, markets: [defaultMarket] });
      }
      throw new Error(`unexpected ${url}`);
    });
  }

  it('resolves via market-context?market=<key>&preview=1 and forwards x-market + x-market-preview', async () => {
    previewOk();
    const h = host();
    const slug = h.split('--')[0];
    const res = await proxy(req(h, '/products/x?a=1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(`/stores/${slug}/market-context?market=eu&preview=1`);
    expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products/x`);
    expect(forwarded(res, 'x-store-slug')).toBe(slug);
    expect(forwarded(res, 'x-market')).toBe('eu');
    expect(forwarded(res, 'x-market-preview')).toBe('1');
    expect(res.headers.get('x-market-preview')).toBe('1');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    // No geo suggestion on a preview host.
    expect(forwarded(res, 'x-market-suggest')).toBeNull();
    // The market default locale (en) is the cookie locale, unprefixed.
    expect(res.headers.get('set-cookie')).toContain('x-store-locale=en');
  });

  it('routes locales like a market host: default unprefixed (301), secondary prefixed, unserved 404', async () => {
    previewOk();
    const h = host();
    const slug = h.split('--')[0];
    const redirect = await proxy(req(h, '/en/products?x=1'));
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe(`http://${h}/products?x=1`);

    const sv = await proxy(req(h, '/sv/products'));
    expect(sv.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products`);
    expect(sv.headers.get('x-middleware-rewrite')).toContain('lang=sv');
    expect(forwarded(sv, 'x-locale')).toBe('sv');
    expect(forwarded(sv, 'x-market-preview')).toBe('1');

    const ar = await proxy(req(h, '/ar/products'));
    expect(ar.status).toBe(404);
    expect(ar.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    // One host lookup for the three requests.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers a disallow-all robots.txt and an empty sitemap.xml itself', async () => {
    previewOk();
    const h = host();
    const robots = await proxy(req(h, '/robots.txt'));
    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(robots.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(robots.headers.get('x-middleware-rewrite')).toBeNull();

    const sitemap = await proxy(req(h, '/sitemap.xml'));
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the plain label when the preview does not resolve (app off / unknown)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) return json({ enabled: false });
      if (url.includes('/market-context')) return json({ enabled: false });
      throw new Error(`unexpected ${url}`);
    });
    const h = host();
    const label = h.split('.')[0];
    const res = await proxy(req(h, '/'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain(`/stores/${label}/market-context`);
    // The usual legacy route for that (non-existent) slug → the app 404s.
    expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${label}`);
    expect(forwarded(res, 'x-market')).toBeNull();
    expect(forwarded(res, 'x-market-preview')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('a lookup error on the preview call falls back the same way', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) throw new Error('down');
      return json({ enabled: false });
    });
    const res = await proxy(req(host(), '/about'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/about');
    expect(forwarded(res, 'x-market-preview')).toBeNull();
  });

  it('a market answered without the preview flag is not a preview', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) {
        return json({ enabled: true, market: { ...euPreview, preview: undefined, status: 'LIVE' }, markets: [] });
      }
      return json({ enabled: false });
    });
    const res = await proxy(req(host(), '/'));
    expect(forwarded(res, 'x-market-preview')).toBeNull();
    expect(forwarded(res, 'x-market')).toBeNull();
  });

  it('normal hosts: no preview lookup, and a spoofed x-market-preview is stripped', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) throw new Error('must not preview');
      return json({ enabled: true, market: defaultMarket, markets: [defaultMarket] });
    });
    const res = await proxy(req('plain-shop.localhost:3000', '/', { 'x-market-preview': '1', 'x-market': 'eu' }));
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/plain-shop/market-context');
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('preview');
    expect(forwarded(res, 'x-market')).toBe('default');
    expect(forwarded(res, 'x-market-preview')).toBeNull();
    expect(res.headers.get('x-market-preview')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });
});
