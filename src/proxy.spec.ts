import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { __resetRedirectCaches } from './lib/redirects';

// M4.4 §11/§15: a store without `redirects_version` must make no extra
// fetch and keep today's rewrite; a store with one gets the 301.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

describe('proxy store redirects', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('legacy store: only the host lookup, no redirect fetch', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const res = await proxy(req('legacy-a.localhost:3000', '/produkt/x?utm=1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/legacy-a/market-context');
    expect(res.headers.get('x-middleware-rewrite')).toContain('/store/legacy-a/produkt/x');
    expect(res.headers.get('location')).toBeNull();
  });

  it('store with redirects: 301 with the query kept', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/market-context')) return json({ enabled: false, redirects_version: 'v1' });
      if (url.includes('/redirects?v=v1')) {
        return json({ version: 'v1', mode: 'map', items: [['/produkt/x', '/products/x', 301]] });
      }
      throw new Error(`unexpected ${url}`);
    });
    const res = await proxy(req('redir-a.localhost:3000', '/Produkt/X/?utm=1'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://redir-a.localhost:3000/products/x?utm=1');

    // A miss falls through to the normal rewrite, with no further fetch.
    const miss = await proxy(req('redir-a.localhost:3000', '/products/x'));
    expect(miss.headers.get('location')).toBeNull();
    expect(miss.headers.get('x-middleware-rewrite')).toContain('/store/redir-a/products/x');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a dotted path is matched against the redirects before the static bypass', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/market-context')) return json({ enabled: false, redirects_version: 'v1' });
      if (url.includes('/redirects?v=v1')) {
        return json({
          version: 'v1',
          mode: 'map',
          items: [
            ['/produkt/x.html', '/products/x', 301],
            ['/feed.xml', '/', 301],
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    const html = await proxy(req('redir-dot.localhost:3000', '/produkt/x.html'));
    expect(html.status).toBe(301);
    expect(html.headers.get('location')).toBe('http://redir-dot.localhost:3000/products/x');
    const feed = await proxy(req('redir-dot.localhost:3000', '/Feed.xml?a=1'));
    expect(feed.headers.get('location')).toBe('http://redir-dot.localhost:3000/?a=1');

    // Other dotted paths keep the static bypass: no rewrite, no redirect.
    const png = await proxy(req('redir-dot.localhost:3000', '/logo.png'));
    expect(png.headers.get('location')).toBeNull();
    expect(png.headers.get('x-middleware-rewrite')).toBeNull();
    expect(png.headers.get('x-middleware-next')).toBe('1');
    // Internal routes bypass before any lookup; the map was fetched once.
    const calls = fetchMock.mock.calls.length;
    const internal = await proxy(req('redir-dot.localhost:3000', '/_next/static/a.js'));
    expect(internal.headers.get('x-middleware-next')).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/redirects?v=v1'))).toHaveLength(1);
  });

  it('legacy store: a dotted path costs only the cached host lookup and is bypassed', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const png = await proxy(req('legacy-dot.localhost:3000', '/logo.png'));
    expect(png.headers.get('x-middleware-next')).toBe('1');
    expect(png.headers.get('x-middleware-rewrite')).toBeNull();
    await proxy(req('legacy-dot.localhost:3000', '/style.css'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('redirect fetch failure fails open', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/market-context')) return json({ enabled: false, redirects_version: 'v1' });
      throw new Error('down');
    });
    const res = await proxy(req('redir-b.localhost:3000', '/produkt/x'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toContain('/store/redir-b/produkt/x');
  });
});
