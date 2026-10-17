import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRedirectCaches,
  buildRedirectLocation,
  fallbackRedirectPath,
  isSafeRedirectTarget,
  matchRedirectMap,
  matchStoreRedirect,
  normalizeRedirectPath,
  redirectFetchHeaders,
  type RedirectHit,
} from './redirects';

// Vectors copied from multi-stores-api/src/modules/redirects/
// redirect-path.util.spec.ts (the contract): keep both in sync.

describe('normalizeRedirectPath', () => {
  it.each([
    ['/produkt/namnskylt', '/produkt/namnskylt'],
    ['/produkt/namnskylt/', '/produkt/namnskylt'],
    ['/Produkt/NamnSkylt', '/produkt/namnskylt'],
    ['//produkt///namnskylt//', '/produkt/namnskylt'],
    ['/produkt/namnskylt?utm=1#top', '/produkt/namnskylt'],
    ['/produkt/%C3%A4pple', '/produkt/äpple'],
    ['/produkt/%c3%84PPLE', '/produkt/äpple'],
    ['/produkt/äpple', '/produkt/äpple'],
    ['/produkt/%E0%A4%A', '/produkt/%e0%a4%a'],
    ['/', '/'],
    ['//', '/'],
    ['  /x/  ', '/x'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeRedirectPath(input)).toBe(expected);
  });

  it.each([
    'produkt/x',
    'https://namez.se/produkt/x',
    '',
    '?x=1',
    '/a\u0000b',
    '/%0a',
    '/' + 'a'.repeat(1024),
  ])('rejects %j', (input) => {
    expect(normalizeRedirectPath(input)).toBeNull();
  });

  it('accepts exactly 1024 characters', () => {
    const p = '/' + 'a'.repeat(1023);
    expect(normalizeRedirectPath(p)).toBe(p);
  });
});

describe('fallbackRedirectPath', () => {
  it.each([
    ['/product-category/barn/page/2', '/product-category/barn'],
    ['/produkt/x/feed', '/produkt/x'],
    ['/produkt/x/amp', '/produkt/x'],
    ['/feed', '/'],
    ['/page/3', '/'],
  ])('%j → %j', (input, expected) => {
    expect(fallbackRedirectPath(input)).toBe(expected);
  });

  it.each(['/produkt/x', '/page/x', '/produkt/feeds', '/produkt/x/page'])(
    'no fallback for %j',
    (input) => {
      expect(fallbackRedirectPath(input)).toBeNull();
    },
  );
});

describe('isSafeRedirectTarget', () => {
  it.each(['/products/namnskylt', '/collections/barn?sort=new', '/products/Äpple', '/'])(
    'accepts %j',
    (to) => expect(isSafeRedirectTarget(to)).toBe(true),
  );
  it.each([
    'products/x',
    '//evil.example/x',
    'https://evil.example/',
    'javascript:alert(1)',
    '/\\evil.example',
    '/%2F%2Fevil.example',
    '/a b',
    '/a\nb',
    '/' + 'a'.repeat(1024),
    42,
  ])('rejects %j', (to) => expect(isSafeRedirectTarget(to)).toBe(false));
});

describe('matchRedirectMap', () => {
  const map = new Map<string, RedirectHit>([
    ['/produkt/namnskylt', { to: '/products/namnskylt', status: 301 }],
    ['/product-category/barn', { to: '/collections/barn', status: 301 }],
  ]);

  it('exact match after normalisation', () => {
    expect(matchRedirectMap(map, '/Produkt/Namnskylt/?ref=x')?.to).toBe('/products/namnskylt');
  });

  it('retries once without /page/<n>, /feed or /amp', () => {
    expect(matchRedirectMap(map, '/product-category/barn/page/4/')?.to).toBe('/collections/barn');
    expect(matchRedirectMap(map, '/produkt/namnskylt/amp')?.to).toBe('/products/namnskylt');
  });

  it('no match and invalid paths answer null', () => {
    expect(matchRedirectMap(map, '/produkt/other')).toBeNull();
    expect(matchRedirectMap(map, 'produkt/namnskylt')).toBeNull();
    expect(matchRedirectMap(map, '/produkt/namnskylt/page/2/feed')).toBeNull();
  });
});

describe('buildRedirectLocation', () => {
  it('keeps the request query', () => {
    expect(buildRedirectLocation('/products/x', '?utm_source=a&b=1')).toBe('/products/x?utm_source=a&b=1');
    expect(buildRedirectLocation('/products/x', '')).toBe('/products/x');
  });
  it('merges with a target query and keeps the fragment last', () => {
    expect(buildRedirectLocation('/collections/barn?sort=new', '?page=2')).toBe('/collections/barn?sort=new&page=2');
    expect(buildRedirectLocation('/p#top', '?a=1')).toBe('/p?a=1#top');
  });
});

describe('matchStoreRedirect', () => {
  const ok = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the map once per slug@version and matches with fallback', async () => {
    fetchMock.mockResolvedValue(
      ok({
        version: 'v1',
        mode: 'map',
        items: [
          ['/produkt/namnskylt', '/products/namnskylt', 301],
          ['/product-category/barn', '/collections/barn', 308],
        ],
      }),
    );
    expect(await matchStoreRedirect('namez', 'v1', '/produkt/Namnskylt/')).toEqual({
      to: '/products/namnskylt',
      status: 301,
    });
    expect(await matchStoreRedirect('namez', 'v1', '/product-category/barn/page/2')).toEqual({
      to: '/collections/barn',
      status: 308,
    });
    expect(await matchStoreRedirect('namez', 'v1', '/products/namnskylt')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/namez/redirects?v=v1');

    // A new version refetches.
    await matchStoreRedirect('namez', 'v2', '/produkt/namnskylt');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops unsafe targets and self-redirects (no loop)', async () => {
    fetchMock.mockResolvedValue(
      ok({
        version: 'v1',
        mode: 'map',
        items: [
          ['/a', '//evil.example/x', 301],
          ['/b', '/B/', 301],
          ['/c', '/c?x=1', 301],
        ],
      }),
    );
    expect(await matchStoreRedirect('s', 'v1', '/a')).toBeNull();
    expect(await matchStoreRedirect('s', 'v1', '/b')).toBeNull();
    expect(await matchStoreRedirect('s', 'v1', '/c')).toBeNull();
  });

  it('uses resolve in lookup mode and caches per path', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ version: 'v1', mode: 'lookup' }))
      .mockResolvedValueOnce(ok({ to: '/products/x', status: 301 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'REDIRECT_NOT_FOUND' }), { status: 404 }),
      );
    expect(await matchStoreRedirect('big', 'v1', '/Produkt/X/')).toEqual({ to: '/products/x', status: 301 });
    expect(String(fetchMock.mock.calls[1]![0])).toContain(
      `/stores/big/redirects/resolve?path=${encodeURIComponent('/produkt/x')}`,
    );
    expect(await matchStoreRedirect('big', 'v1', '/produkt/x')).toEqual({ to: '/products/x', status: 301 });
    expect(await matchStoreRedirect('big', 'v1', '/nothing')).toBeNull();
    expect(await matchStoreRedirect('big', 'v1', '/nothing')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails open on fetch errors and non-2xx', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await matchStoreRedirect('s', 'v1', '/a')).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    expect(await matchStoreRedirect('t', 'v1', '/a')).toBeNull();
  });

  it('an answer without a version is a failure (short TTL), never "no redirects"', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
    try {
      fetchMock
        .mockResolvedValueOnce(ok({ version: null, mode: 'map', items: [] }))
        .mockResolvedValueOnce(ok({ version: 'v1', mode: 'map', items: [['/a', '/b', 301]] }));
      expect(await matchStoreRedirect('u', 'v1', '/a')).toBeNull();
      // Cached as a failure, not refetched at once...
      expect(await matchStoreRedirect('u', 'v1', '/a')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // ...but retried after the short failure TTL, not the 10-minute map TTL.
      vi.setSystemTime(Date.now() + 11_000);
      expect(await matchStoreRedirect('u', 'v1', '/a')).toEqual({ to: '/b', status: 301 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes no fetch without a version', async () => {
    expect(await matchStoreRedirect('s', '', '/a')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('proxy key header', () => {
  const ok = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  let fetchMock: ReturnType<typeof vi.fn>;
  const headerOf = (call: unknown[]): string | null => {
    const init = call[1] as RequestInit | undefined;
    return new Headers(init?.headers).get('x-proxy-key');
  };

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends no header when REDIRECTS_PROXY_KEY is unset', async () => {
    vi.stubEnv('REDIRECTS_PROXY_KEY', '');
    expect(redirectFetchHeaders()).toBeUndefined();
    fetchMock.mockResolvedValue(ok({ version: 'v1', mode: 'map', items: [] }));
    await matchStoreRedirect('s', 'v1', '/a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headerOf(fetchMock.mock.calls[0]!)).toBeNull();
  });

  it('sends x-proxy-key on the map and resolve calls when set', async () => {
    vi.stubEnv('REDIRECTS_PROXY_KEY', 'k'.repeat(32));
    fetchMock
      .mockResolvedValueOnce(ok({ version: 'v1', mode: 'lookup' }))
      .mockResolvedValueOnce(ok({ to: '/products/x', status: 301 }));
    expect(await matchStoreRedirect('big', 'v1', '/produkt/x')).toEqual({ to: '/products/x', status: 301 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/big/redirects?v=v1');
    expect(headerOf(fetchMock.mock.calls[0]!)).toBe('k'.repeat(32));
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/stores/big/redirects/resolve?path=');
    expect(headerOf(fetchMock.mock.calls[1]!)).toBe('k'.repeat(32));
  });
});
