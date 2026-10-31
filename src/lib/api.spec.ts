import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, legal, storefront, storeTag } from './api';
import { routeSlug } from './slugRoute';

type Call = { url: string; init: RequestInit & { next?: { tags?: string[]; revalidate?: number } } };

let calls: Call[];

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response;
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init: init as Call['init'] });
      return okJson(url.endsWith('/cache-config') ? { enabled: true } : { ok: 1 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const headersOf = (c: Call) => c.init.headers as Record<string, string>;

describe('api() headers', () => {
  it('sends no Content-Type on a GET without body', async () => {
    await api('/x');
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined();
  });

  it('sends JSON Content-Type when there is a body', async () => {
    await api('/x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(headersOf(calls[0])['Content-Type']).toBe('application/json');
  });

  it('leaves FormData bodies to set their own Content-Type', async () => {
    await api('/x', { method: 'POST', body: new FormData() });
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined();
  });

  it('keeps caller headers and the bearer token', async () => {
    await api('/x', { token: 't', headers: { 'X-A': '1' } });
    expect(headersOf(calls[0])).toEqual({ 'X-A': '1', Authorization: 'Bearer t' });
  });
});

describe('storefront cache options', () => {
  it('on the server (production) reads cache-config and tags the fetch', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await storefront.getStore('namez');
    expect(calls.map((c) => c.url.replace(/^.*\/storefront/, ''))).toEqual(['/namez/cache-config', '/namez']);
    expect(calls[0].init.next).toEqual({ tags: [storeTag('namez')], revalidate: 30 });
    expect(calls[1].init.next).toEqual({ tags: [storeTag('namez')], revalidate: 3600 });
  });

  it('in the browser (production) skips cache-config and Next cache options', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('window', {});
    await storefront.getStore('namez');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/storefront\/namez$/);
    expect(calls[0].init.next).toBeUndefined();
    expect(calls[0].init.cache).toBeUndefined();
  });

  it('in development never caches', async () => {
    await storefront.getStore('namez');
    expect(calls).toHaveLength(1);
    expect(calls[0].init.cache).toBe('no-store');
  });
});

// Route params reach the pages percent-encoded; the pages decode them with
// `routeSlug` and the API helpers encode exactly once.
describe('slug encoding in API paths', () => {
  const ar = 'هدية';
  const arEncoded = encodeURIComponent(ar);

  it('legal.get encodes a decoded route param once (no %25)', async () => {
    await legal.get(routeSlug(arEncoded), 'ar');
    expect(calls[0].url).toContain(`/legal/${arEncoded}?locale=ar`);
    expect(calls[0].url).not.toContain('%25');
  });

  it('product and page lookups encode the decoded slug once', async () => {
    await storefront.getProduct('namez', routeSlug(encodeURIComponent('Tröja')));
    await storefront.getPage('namez', routeSlug(arEncoded));
    await storefront.getPublishedPage('namez', routeSlug(arEncoded));
    const urls = calls.map((c) => c.url).filter((u) => !u.endsWith('/cache-config'));
    expect(urls[0]).toMatch(/\/storefront\/namez\/products\/tr%C3%B6ja$/);
    expect(urls[1]).toMatch(new RegExp(`/storefront/namez/pages/${arEncoded}$`));
    expect(urls[2]).toMatch(new RegExp(`/storefront/namez/v2/pages/${arEncoded}$`));
    for (const u of urls) expect(u).not.toContain('%25');
  });
});
