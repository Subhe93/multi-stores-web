import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

// Store favicon: `/favicon.ico` on a store host is rewritten to the store
// route (which answers with the store's own icon); a platform host keeps
// serving the static platform file.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function req(host: string, path: string): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

describe('proxy /favicon.ico', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the matcher no longer skips /favicon.ico', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test('/favicon.ico')).toBe(true);
    expect(pattern.test('/_next/static/a.js')).toBe(false);
  });

  it('store host: rewritten to the store favicon route', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const res = await proxy(req('fav-a.localhost:3000', '/favicon.ico'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/store/fav-a/favicon.ico');
    expect(res.headers.get('location')).toBeNull();
  });

  it('market store host: rewritten with the market forwarded', async () => {
    const market = { key: 'se', default_locale: 'sv', locales: ['sv'], countries: ['SE'], status: 'LIVE' };
    fetchMock.mockResolvedValue(json({ enabled: true, market, markets: [market] }));
    const res = await proxy(req('fav-m.localhost:3000', '/favicon.ico'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/store/fav-m/favicon.ico');
    expect(res.headers.get('x-middleware-request-x-market')).toBe('se');
  });

  it('platform host: passes through, no lookup', async () => {
    const res = await proxy(req('localhost:3000', '/favicon.ico'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('other static files on a store host keep the bypass', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false }));
    const res = await proxy(req('fav-b.localhost:3000', '/logo.png'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
