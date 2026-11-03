import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Domain-move overlap (plans/domain-move/PLAN.md): the proxy reads its
// platform host list from the environment at module load, so every case
// stubs the env, resets the module registry and imports the proxy afresh.
// A request on `muba.<old apex>` and on `muba.<new apex>` both resolve the
// store `muba`; the apexes (bare and www) are the marketing site; a custom
// domain is neither; `/store/<slug>` redirects to the NEW domain.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string): NextRequest {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

async function loadProxy(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const mod = await import('./proxy');
  const redirects = await import('./lib/redirects');
  redirects.__resetRedirectCaches();
  return mod.proxy;
}

const BOTH = {
  NEXT_PUBLIC_WEB_URL: 'https://shopsdoor.com',
  NEXT_PUBLIC_PLATFORM_HOSTS: 'shopsdoor.com,www.shopsdoor.com,iwings-digital.com,www.iwings-digital.com',
  NEXT_PUBLIC_PLATFORM_DOMAIN: '',
  NEXT_PUBLIC_API_URL: 'https://api.shopsdoor.com/api',
};

describe('proxy host detection with both platform domains listed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('a store subdomain under the old and the new apex both resolve the slug', async () => {
    const proxy = await loadProxy(BOTH);
    fetchMock.mockResolvedValue(json({ enabled: false }));
    for (const host of ['muba.iwings-digital.com', 'muba.shopsdoor.com']) {
      const res = await proxy(req(host, '/products/x'));
      expect(res.headers.get('x-middleware-rewrite')).toContain('/store/muba/products/x');
      expect(res.headers.get('x-store-slug')).toBe('muba');
      expect(res.headers.get('location')).toBeNull();
    }
    // Only the market-context lookups; no custom-domain resolution.
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain('/stores/muba/market-context');
    }
  });

  it('the apexes (bare and www) are the platform, not a store', async () => {
    const proxy = await loadProxy(BOTH);
    for (const host of ['shopsdoor.com', 'www.shopsdoor.com', 'iwings-digital.com', 'www.iwings-digital.com']) {
      const res = await proxy(req(host, '/pricing'));
      expect(res.headers.get('x-store-slug')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toContain('/en/pricing');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a custom domain is neither: resolved through the API', async () => {
    const proxy = await loadProxy(BOTH);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/stores/by-domain')) return json({ slug: 'namez-se', market: null, markets: [] });
      if (url.includes('/market-context')) return json({ enabled: false });
      throw new Error(`unexpected ${url}`);
    });
    const res = await proxy(req('namez.se', '/'));
    expect(res.headers.get('x-store-slug')).toBe('namez-se');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('namez.se');
  });

  it('/store/<slug> redirects to the NEW domain once NEXT_PUBLIC_WEB_URL moved', async () => {
    const proxy = await loadProxy(BOTH);
    for (const host of ['shopsdoor.com', 'iwings-digital.com']) {
      const res = await proxy(req(host, '/store/muba/products/x?orderId=1'));
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.headers.get('location')).toBe('https://muba.shopsdoor.com/products/x?orderId=1');
    }
  });

  it('NEXT_PUBLIC_PLATFORM_DOMAIN still wins over the derived default', async () => {
    const proxy = await loadProxy({ ...BOTH, NEXT_PUBLIC_PLATFORM_DOMAIN: 'shops.example' });
    const res = await proxy(req('shopsdoor.com', '/store/muba'));
    expect(res.headers.get('location')).toBe('https://muba.shops.example/');
  });

  it('nothing configured: localhost only (no hardcoded production apex)', async () => {
    const proxy = await loadProxy({
      NEXT_PUBLIC_WEB_URL: '',
      NEXT_PUBLIC_PLATFORM_HOSTS: '',
      NEXT_PUBLIC_PLATFORM_DOMAIN: '',
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/stores/by-domain')) return json(null, 404);
      return json({ enabled: false });
    });
    // The old apex is now an unknown host → custom-domain lookup, not a store slug.
    await proxy(req('muba.iwings-digital.com', '/'));
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/by-domain');
    // A dev subdomain still resolves locally.
    fetchMock.mockClear();
    const dev = await proxy(new NextRequest('http://muba.localhost:3000/', { headers: { host: 'muba.localhost:3000' } }));
    expect(dev.headers.get('x-store-slug')).toBe('muba');
  });
});
