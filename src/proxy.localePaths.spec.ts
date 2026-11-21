import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { __resetRedirectCaches } from './lib/redirects';
import { NAMEZ_EU, NAMEZ_EU_PATHS, NAMEZ_SE } from './lib/localePaths.fixtures';

// M156 §4.4: proxy behaviour of a market with language-country paths
// (headers, ms-region cookie, redirects in one hop) and the regression rule
// for markets without them.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } });
}

/** Request headers the proxy forwards to the app (`x-middleware-request-*`). */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

// Indexable on the platform subdomain, so no host redirect gets in the way.
const eu = { ...NAMEZ_EU, primary_hostname: null, indexing: 'ALWAYS' as const };
const se = { ...NAMEZ_SE, primary_hostname: null, indexing: 'ALWAYS' as const };

let n = 0;
/** A fresh platform-subdomain host per test (the proxy caches host lookups). */
function host(): { host: string; slug: string } {
  const slug = `lp-store-${++n}`;
  return { host: `${slug}.localhost:3000`, slug };
}

function mockContext(fetchMock: ReturnType<typeof vi.fn>, market: unknown, redirects?: [string, string, number][]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/market-context')) {
      return json({ enabled: true, market, markets: [market], ...(redirects ? { redirects_version: 'v1' } : {}) });
    }
    if (redirects && url.includes('/redirects?v=v1')) return json({ version: 'v1', mode: 'map', items: redirects });
    throw new Error(`unexpected ${url}`);
  });
}

describe('proxy: locale-path market', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('/de-at/…: locale de, prefix + country headers, ms-region=AT cookie', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const res = await proxy(req(h.host, '/de-at/products/x'));
    const rewrite = new URL(res.headers.get('x-middleware-rewrite')!);
    expect(rewrite.pathname).toBe(`/store/${h.slug}/products/x`);
    expect(rewrite.searchParams.get('lang')).toBe('de');
    expect(forwarded(res, 'x-locale')).toBe('de');
    expect(forwarded(res, 'x-store-path-prefix')).toBe('/de-at');
    expect(forwarded(res, 'x-locale-country')).toBe('AT');
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('x-store-locale=de');
    expect(cookies).toMatch(/ms-region=AT; Path=\/; .*Max-Age=31536000/i);
    expect(cookies.toLowerCase()).toContain('samesite=lax');
  });

  it('every active country row sets its own country', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    for (const [path, locale, country] of [['/de-de/x', 'de', 'DE'], ['/fr-fr/x', 'fr', 'FR'], ['/fr-be', 'fr', 'BE']] as const) {
      const res = await proxy(req(h.host, path));
      expect(forwarded(res, 'x-locale')).toBe(locale);
      expect(forwarded(res, 'x-locale-country')).toBe(country);
      expect(res.headers.get('set-cookie')).toContain(`ms-region=${country}`);
    }
  });

  it('no country (root, /ar): prefix header only, no ms-region cookie', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const root = await proxy(req(h.host, '/products/x'));
    expect(forwarded(root, 'x-store-path-prefix')).toBe('/');
    expect(forwarded(root, 'x-locale-country')).toBeNull();
    expect(root.headers.get('set-cookie') ?? '').not.toContain('ms-region');
    const ar = await proxy(req(h.host, '/ar/products/x'));
    expect(forwarded(ar, 'x-store-path-prefix')).toBe('/ar');
    expect(forwarded(ar, 'x-locale')).toBe('ar');
    expect(forwarded(ar, 'x-locale-country')).toBeNull();
    expect(ar.headers.get('set-cookie') ?? '').not.toContain('ms-region');
  });

  it('the cookie is not rewritten when it already holds the path country', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const res = await proxy(req(h.host, '/de-at/x', { cookie: 'ms-region=AT' }));
    expect(res.headers.get('set-cookie') ?? '').not.toContain('ms-region');
    const other = await proxy(req(h.host, '/de-at/x', { cookie: 'ms-region=DE' }));
    expect(other.headers.get('set-cookie')).toContain('ms-region=AT');
  });

  it('spoofed inbound headers are replaced on the market and stripped elsewhere', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const spoof = { 'x-store-path-prefix': '/evil', 'x-locale-country': 'XX' };
    const res = await proxy(req(h.host, '/products/x', spoof));
    expect(forwarded(res, 'x-store-path-prefix')).toBe('/');
    expect(forwarded(res, 'x-locale-country')).toBeNull();

    // A market without locale paths and a legacy store never forward them.
    mockContext(fetchMock, se);
    const s = host();
    const seRes = await proxy(req(s.host, '/products/x', spoof));
    expect(forwarded(seRes, 'x-store-path-prefix')).toBeNull();
    expect(forwarded(seRes, 'x-locale-country')).toBeNull();
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const l = host();
    const legacy = await proxy(req(l.host, '/products/x', spoof));
    expect(forwarded(legacy, 'x-store-path-prefix')).toBeNull();
    expect(forwarded(legacy, 'x-locale-country')).toBeNull();
  });

  it('old bare folders 301 to the primary path in one hop, query kept; /de/ is a single 301', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const de = await proxy(req(h.host, '/de/products/x?utm=1'));
    expect(de.status).toBe(301);
    expect(de.headers.get('location')).toBe(`http://${h.host}/de-de/products/x?utm=1`);
    const slash = await proxy(req(h.host, '/de/'));
    expect(slash.status).toBe(301);
    expect(slash.headers.get('location')).toBe(`http://${h.host}/de-de`);
    const frSlash = await proxy(req(h.host, '/fr/collections/a/?p=2'));
    expect(frSlash.status).toBe(301);
    expect(frSlash.headers.get('location')).toBe(`http://${h.host}/fr-fr/collections/a?p=2`);
    // A slash form that is not a redirect keeps the plain 308.
    const at = await proxy(req(h.host, '/de-at/'));
    expect(at.status).toBe(308);
    expect(at.headers.get('location')).toBe(`http://${h.host}/de-at`);
  });

  it('inactive nl paths are a 404 on the market-not-found route', async () => {
    mockContext(fetchMock, eu);
    const h = host();
    const res = await proxy(req(h.host, '/nl-be/products/x'));
    expect(res.status).toBe(404);
    expect(new URL(res.headers.get('x-middleware-rewrite')!).pathname).toBe(`/store/${h.slug}/market-not-found`);
    expect(res.headers.get('set-cookie')).toContain('x-store-locale=en');
  });

  it('a preview host does not write ms-region', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('preview=1')) return json({ enabled: true, preview: true, market: { ...eu, preview: true }, markets: [] });
      return json({ enabled: false });
    });
    const res = await proxy(req(`lp-prev-${++n}--eu.localhost:3000`, '/de-at/x'));
    expect(forwarded(res, 'x-locale-country')).toBe('AT');
    expect(res.headers.get('set-cookie') ?? '').not.toContain('ms-region');
  });
});

describe('proxy: store redirects on a locale-path market (§4.5)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a /de/ target is rewritten to /de-de/ in the same hop', async () => {
    mockContext(fetchMock, eu, [
      ['/de/produkt/x', '/de/products/y', 301],
      ['/produkt/z', '/fr/products/z', 301],
      ['/ar/produkt/a', '/ar/products/a', 301],
    ]);
    const h = host();
    const de = await proxy(req(h.host, '/de/produkt/x?utm=1'));
    expect(de.status).toBe(301);
    expect(de.headers.get('location')).toBe(`http://${h.host}/de-de/products/y?utm=1`);
    const fr = await proxy(req(h.host, '/produkt/z/'));
    expect(fr.headers.get('location')).toBe(`http://${h.host}/fr-fr/products/z`);
    const ar = await proxy(req(h.host, '/ar/produkt/a'));
    expect(ar.headers.get('location')).toBe(`http://${h.host}/ar/products/a`);
  });

  it('/de-at/<old slug> finds the bare /de/ rule and stays on /de-at/', async () => {
    mockContext(fetchMock, eu, [
      ['/de/products/old', '/de/products/new', 301],
      ['/de/sale', '/fr/soldes', 301],
    ]);
    const h = host();
    const at = await proxy(req(h.host, '/de-at/products/old'));
    expect(at.status).toBe(301);
    expect(at.headers.get('location')).toBe(`http://${h.host}/de-at/products/new`);
    const de = await proxy(req(h.host, '/de-de/products/old'));
    expect(de.headers.get('location')).toBe(`http://${h.host}/de-de/products/new`);
    // A target in another locale goes to that locale's primary path.
    const sale = await proxy(req(h.host, '/de-at/sale'));
    expect(sale.headers.get('location')).toBe(`http://${h.host}/fr-fr/soldes`);
  });

  it('a target that is the request path after the remap is ignored (no loop)', async () => {
    mockContext(fetchMock, eu, [['/de/old', '/de-de/old', 301]]);
    const h = host();
    const res = await proxy(req(h.host, '/de-de/old'));
    expect(res.headers.get('location')).toBeNull();
    expect(new URL(res.headers.get('x-middleware-rewrite')!).pathname).toBe(`/store/${h.slug}/old`);
  });

  it('a market without locale paths keeps the old redirect behaviour (no remap, no alias lookup)', async () => {
    mockContext(fetchMock, se, [['/de/produkt/x', '/de/products/y', 301], ['/en/old', '/en/new', 301]]);
    const h = host();
    const res = await proxy(req(h.host, '/de/produkt/x'));
    expect(res.headers.get('location')).toBe(`http://${h.host}/de/products/y`);
    const miss = await proxy(req(h.host, '/de-at/products/old'));
    expect(miss.headers.get('location')).toBeNull();
    expect(new URL(miss.headers.get('x-middleware-rewrite')!).pathname).toBe(`/store/${h.slug}/de-at/products/old`);
    expect(forwarded(miss, 'x-store-path-prefix')).toBeNull();
  });

  it('the fixture keeps the nl rows (they stay inactive)', () => {
    expect(NAMEZ_EU_PATHS.some((r) => r.locale === 'nl')).toBe(true);
  });
});
