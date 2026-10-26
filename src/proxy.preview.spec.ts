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
    // ALWAYS so the hostless platform subdomain stays indexable in this test.
    const always = { ...defaultMarket, indexing: 'ALWAYS' };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) throw new Error('must not preview');
      return json({ enabled: true, market: always, markets: [always] });
    });
    const res = await proxy(req('plain-shop.localhost:3000', '/', { 'x-market-preview': '1', 'x-market': 'eu' }));
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/plain-shop/market-context');
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('preview');
    expect(forwarded(res, 'x-market')).toBe('default');
    expect(forwarded(res, 'x-market-preview')).toBeNull();
    expect(res.headers.get('x-market-preview')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('forwards x-store-noindex on a preview host', async () => {
    previewOk();
    const res = await proxy(req(host(), '/'));
    expect(forwarded(res, 'x-store-noindex')).toBe('1');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

// M6.1: the effective indexing rule is computed by the proxy per host type.
describe('proxy market indexing mode (M6.1)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let n = 0;
  const platformHost = () => `shop-${++n}.localhost:3000`;
  const customHost = () => `custom-${++n}.example.com`;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Platform subdomain → market-context; custom domain → by-domain. */
  function serve(market: Record<string, unknown>, slug = 'namez', customDomain: string | null = null) {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) throw new Error('must not preview');
      if (url.includes('/stores/by-domain/')) {
        return json({ slug, market, markets: [market], redirect_to: null, custom_domain: customDomain });
      }
      if (url.includes('/market-context')) {
        return json({ enabled: true, market, markets: [market], custom_domain: customDomain });
      }
      throw new Error(`unexpected ${url}`);
    });
  }

  function expectNoindex(res: Response) {
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(forwarded(res, 'x-store-noindex')).toBe('1');
  }
  function expectIndexable(res: Response) {
    expect(res.headers.get('x-robots-tag')).toBeNull();
    expect(forwarded(res, 'x-store-noindex')).toBeNull();
  }

  it('NEVER: noindex on the platform subdomain and on the custom domain (prefixed pages and 404s too)', async () => {
    serve({ ...defaultMarket, primary_hostname: 'namez.se', indexing: 'NEVER' });
    const h = platformHost();
    const slug = h.split('.')[0];
    const home = await proxy(req(h, '/'));
    expect(home.status).toBe(200);
    expect(home.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}`);
    expectNoindex(home);
    expect(forwarded(home, 'x-market-preview')).toBeNull();
    const en = await proxy(req(h, '/en/products/x'));
    expect(en.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products/x`);
    expectNoindex(en);
    const nf = await proxy(req(h, '/de/products/x'));
    expect(nf.status).toBe(404);
    expectNoindex(nf);
    // Never redirected to the custom domain, even though it has one.
    expect(home.headers.get('location')).toBeNull();

    const custom = await proxy(req(customHost(), '/products/x'));
    expect(custom.headers.get('x-middleware-rewrite')).toContain('/store/namez/products/x');
    expectNoindex(custom);
  });

  it('NEVER: robots.txt and sitemap.xml are rewritten to the store routes with the noindex flag (no Disallow from the proxy)', async () => {
    serve({ ...defaultMarket, indexing: 'NEVER' });
    const h = platformHost();
    const slug = h.split('.')[0];
    const robots = await proxy(req(h, '/robots.txt'));
    expect(robots.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/robots.txt`);
    expect(forwarded(robots, 'x-store-noindex')).toBe('1');
    expect(forwarded(robots, 'x-market')).toBe('default');
    const sitemap = await proxy(req(h, '/sitemap.xml'));
    expect(sitemap.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/sitemap.xml`);
    expect(forwarded(sitemap, 'x-store-noindex')).toBe('1');
  });

  it('ALWAYS: indexable on the platform subdomain (no 301 despite a primary hostname) and on the custom domain', async () => {
    serve({ ...defaultMarket, primary_hostname: 'namez.se', indexing: 'ALWAYS' });
    const h = platformHost();
    const page = await proxy(req(h, '/products/x?a=1'));
    expect(page.status).toBe(200);
    expect(page.headers.get('location')).toBeNull();
    expectIndexable(page);
    const sitemap = await proxy(req(h, '/sitemap.xml'));
    expect(forwarded(sitemap, 'x-store-noindex')).toBeNull();
    const custom = await proxy(req(customHost(), '/'));
    expectIndexable(custom);
  });

  it('AUTO without a primary hostname: noindex on the platform subdomain', async () => {
    serve({ ...defaultMarket, primary_hostname: null });
    const h = platformHost();
    const home = await proxy(req(h, '/'));
    expect(home.status).toBe(200);
    expect(home.headers.get('location')).toBeNull();
    expectNoindex(home);
    const en = await proxy(req(h, '/en/about'));
    expectNoindex(en);
    const sitemap = await proxy(req(h, '/sitemap.xml'));
    expect(forwarded(sitemap, 'x-store-noindex')).toBe('1');
  });

  it('AUTO (explicit) on the custom domain: indexable', async () => {
    serve({ ...defaultMarket, primary_hostname: 'namez.se', indexing: 'AUTO' });
    const custom = await proxy(req(customHost(), '/en/products/x'));
    expect(custom.headers.get('x-middleware-rewrite')).toContain('/store/namez/products/x');
    expectIndexable(custom);
    const sitemap = await proxy(req(customHost(), '/sitemap.xml'));
    expect(forwarded(sitemap, 'x-store-noindex')).toBeNull();
  });

  it('AUTO with a primary hostname on the platform subdomain: 301 to the custom domain, path + query kept', async () => {
    serve({ ...defaultMarket, primary_hostname: 'namez.se' });
    const h = platformHost();
    const home = await proxy(req(h, '/'));
    expect(home.status).toBe(301);
    expect(home.headers.get('location')).toBe('https://namez.se/');
    const page = await proxy(req(h, '/en/products/x?a=1&b=2'));
    expect(page.status).toBe(301);
    expect(page.headers.get('location')).toBe('https://namez.se/en/products/x?a=1&b=2');
    expect(page.headers.get('x-robots-tag')).toBeNull();
  });

  it('AUTO 301: bypass paths are never redirected', async () => {
    serve({ ...defaultMarket, primary_hostname: 'namez.se' });
    const h = platformHost();
    const slug = h.split('.')[0];
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const res = await proxy(req(h, path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}${path}`);
      // The verdict for this host is "redirect", not noindex: the routes
      // answer normally for the host they were asked on.
      expect(forwarded(res, 'x-store-noindex')).toBeNull();
    }
    for (const path of ['/api/platform-probe', '/api/x', '/_next/static/x.js', '/builder-preview/x']) {
      const res = await proxy(req(h, path));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });

  it('AUTO default market without a StoreDomain row but with a legacy custom_domain: indexable there, 301 from the platform subdomain', async () => {
    serve({ ...defaultMarket, primary_hostname: null }, 'namez', 'resumely.net');
    const h = platformHost();
    const page = await proxy(req(h, '/en/products/x?a=1'));
    expect(page.status).toBe(301);
    expect(page.headers.get('location')).toBe('https://resumely.net/en/products/x?a=1');
    // robots/sitemap still answered on the subdomain, not redirected.
    const robots = await proxy(req(h, '/robots.txt'));
    expect(robots.headers.get('location')).toBeNull();
    expect(forwarded(robots, 'x-store-noindex')).toBeNull();
    // On the legacy custom domain itself (by-domain): indexable.
    const custom = await proxy(req('resumely.net', '/products/x'));
    expect(custom.headers.get('x-middleware-rewrite')).toContain('/store/namez/products/x');
    expectIndexable(custom);
    // NEVER still wins over the legacy domain.
    const never = { ...defaultMarket, primary_hostname: null, indexing: 'NEVER' };
    serve(never, 'namez', 'resumely.net');
    const h2 = platformHost();
    const res = await proxy(req(h2, '/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expectNoindex(res);
    // A NON-default market never inherits the legacy domain.
    const secondary = { ...defaultMarket, key: 'eu', is_default: false, primary_hostname: null };
    serve(secondary, 'namez', 'resumely.net');
    const res2 = await proxy(req(platformHost(), '/'));
    expect(res2.status).toBe(200);
    expect(res2.headers.get('location')).toBeNull();
    expectNoindex(res2);
  });

  it('AUTO 301 never targets the request host itself (loop guard): served in place, indexable', async () => {
    const h = platformHost();
    const bare = h.split(':')[0]!;
    serve({ ...defaultMarket, primary_hostname: bare });
    const res = await proxy(req(h, '/en/products/x?a=1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toContain('/products/x');
    expectIndexable(res);
    // Same via the legacy custom_domain of a row-less default market.
    const h2 = platformHost();
    serve({ ...defaultMarket, primary_hostname: null }, 'namez', h2.split(':')[0]!);
    const res2 = await proxy(req(h2, '/'));
    expect(res2.status).toBe(200);
    expect(res2.headers.get('location')).toBeNull();
    expectIndexable(res2);
  });

  it('a spoofed x-store-noindex is stripped on an indexable host', async () => {
    serve({ ...defaultMarket, indexing: 'ALWAYS' });
    const res = await proxy(req(platformHost(), '/', { 'x-store-noindex': '1' }));
    expectIndexable(res);
  });

  it('legacy stores (markets app off) are untouched: no verdict, no header, no redirect', async () => {
    fetchMock.mockImplementation(async () => json({ enabled: false }));
    const h = platformHost();
    const slug = h.split('.')[0];
    const res = await proxy(req(h, '/ar/products?x=1', { 'x-store-noindex': '1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products`);
    expect(forwarded(res, 'x-market')).toBeNull();
    expectIndexable(res);
  });
});
