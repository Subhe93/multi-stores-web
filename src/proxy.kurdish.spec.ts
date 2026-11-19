import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { __resetRedirectCaches } from './lib/redirects';

// Store-only locale 'ku' (Kurmanji, in review): the store branches accept the
// `/ku/` prefix (legacy stores: the layout then 404s when the store has not
// enabled it; market stores: only when the market serves it), the page is
// flagged noindex, and the platform keeps its six locales.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

/** Request headers the proxy forwards to the app (`x-middleware-request-*`). */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

const market = (locales: string[]) => ({
  key: 'default',
  name: 'Sweden',
  default_locale: 'sv',
  locales,
  countries: ['SE'],
  currency: 'SEK',
  is_default: true,
  primary_hostname: null,
  status: 'LIVE',
  // Indexable on the platform subdomain, so only the locale decides noindex.
  indexing: 'ALWAYS',
});

describe('proxy: store-only review locale ku', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let n = 0;
  const host = () => `ku-store-${++n}.localhost:3000`;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('legacy store: /ku/... is stripped to the store path with lang=ku, noindex', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const h = host();
    const slug = h.split('.')[0];
    const res = await proxy(req(h, '/ku/products/x'));
    const rewrite = res.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite).toContain(`/store/${slug}/products/x`);
    expect(rewrite).toContain('lang=ku');
    expect(forwarded(res, 'x-locale')).toBe('ku');
    expect(forwarded(res, 'x-store-noindex')).toBe('1');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('set-cookie')).toContain('x-store-locale=ku');

    const home = await proxy(req(h, '/ku'));
    expect(home.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}?lang=ku`);
    expect(forwarded(home, 'x-locale')).toBe('ku');
  });

  it('legacy store: the six locales and unprefixed paths are routed as before', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const h = host();
    const slug = h.split('.')[0];
    const ar = await proxy(req(h, '/ar/cart'));
    expect(ar.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/cart`);
    expect(forwarded(ar, 'x-locale')).toBe('ar');
    expect(forwarded(ar, 'x-store-noindex')).toBeNull();
    expect(ar.headers.get('x-robots-tag')).toBeNull();

    const plain = await proxy(req(h, '/products'));
    expect(plain.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products`);
    expect(forwarded(plain, 'x-locale')).toBeNull();
    expect(plain.headers.get('x-robots-tag')).toBeNull();

    // A first segment that only starts with "ku" is a page slug, not a locale.
    const kurta = await proxy(req(h, '/kurta'));
    expect(kurta.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/kurta`);
    expect(forwarded(kurta, 'x-locale')).toBeNull();
  });

  it('market store serving ku: prefixed rewrite, noindex', async () => {
    fetchMock.mockResolvedValue(json({ enabled: true, market: market(['en', 'ku']), markets: [market(['en', 'ku'])] }));
    const h = host();
    const slug = h.split('.')[0];
    const res = await proxy(req(h, '/ku/products'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/products`);
    expect(forwarded(res, 'x-locale')).toBe('ku');
    expect(forwarded(res, 'x-store-noindex')).toBe('1');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');

    // Its other locales stay indexable.
    const en = await proxy(req(h, '/en/products'));
    expect(forwarded(en, 'x-locale')).toBe('en');
    expect(forwarded(en, 'x-store-noindex')).toBeNull();
    expect(en.headers.get('x-robots-tag')).toBeNull();
  });

  it('market store without ku: /ku/... is the market 404', async () => {
    fetchMock.mockResolvedValue(json({ enabled: true, market: market(['en']), markets: [market(['en'])] }));
    const h = host();
    const slug = h.split('.')[0];
    const res = await proxy(req(h, '/ku/products'));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toContain(`/store/${slug}/market-not-found`);
  });

  it('platform host: /ku is not a platform locale (no ku platform pages)', async () => {
    const res = await proxy(req('localhost:3000', '/ku'));
    expect(forwarded(res, 'x-locale')).toBe('en');
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/ku');
  });
});
