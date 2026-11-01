import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { __resetRedirectCaches } from './lib/redirects';
import {
  isDefinitiveNotFound,
  maintenanceLang,
  MAINTENANCE_RETRY_AFTER_SECONDS,
} from './lib/apiAvailability';

// API unreachable (maintenance window): store hosts answer 503 + Retry-After
// + noindex, never a 404 or the platform fallback.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const nginx502 = () =>
  new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
    status: 502,
    headers: { 'content-type': 'text/html' },
  });
const refused = () => Promise.reject(new TypeError('fetch failed'));

// The host cache is module-level: every test uses its own hosts.
let n = 0;
const uniq = (base: string) => `${base}-${++n}`;

function req(host: string, path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } });
}

async function expectMaintenance(res: Response) {
  expect(res.status).toBe(503);
  expect(res.headers.get('retry-after')).toBe(String(MAINTENANCE_RETRY_AFTER_SECONDS));
  expect(res.headers.get('x-robots-tag')).toBe('noindex');
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  expect(res.headers.get('location')).toBeNull();
  const html = await res.text();
  expect(html).toContain('<meta name="robots" content="noindex">');
  return html;
}

describe('proxy while the API is unreachable', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetRedirectCaches();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('platform subdomain, connection refused: 503 maintenance page', async () => {
    fetchMock.mockImplementation(refused);
    const res = await proxy(req(`${uniq('down-a')}.localhost:3000`, '/products/x'));
    const html = await expectMaintenance(res);
    expect(html).toContain("We'll be right back");
  });

  it('platform subdomain, nginx 502 / 504: 503 maintenance page', async () => {
    for (const make of [nginx502, () => new Response('timeout', { status: 504 })]) {
      fetchMock.mockImplementation(async () => make());
      await expectMaintenance(await proxy(req(`${uniq('down-b')}.localhost:3000`, '/')));
    }
  });

  it('custom domain, connection refused: 503 instead of the platform fallback', async () => {
    fetchMock.mockImplementation(refused);
    const res = await proxy(req(`${uniq('shop')}.example.se`, '/'));
    await expectMaintenance(res);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/stores/by-domain/');
  });

  it('robots.txt and sitemap.xml get the 503 too (crawlers pause the host)', async () => {
    fetchMock.mockImplementation(refused);
    const host = `${uniq('down-r')}.localhost:3000`;
    await expectMaintenance(await proxy(req(host, '/robots.txt')));
    await expectMaintenance(await proxy(req(host, '/sitemap.xml')));
  });

  it('static files are still served', async () => {
    fetchMock.mockImplementation(refused);
    const res = await proxy(req(`${uniq('down-s')}.localhost:3000`, '/logo.png'));
    expect(res.status).toBe(200);
    expect(res.headers.get('retry-after')).toBeNull();
  });

  it('localised by Accept-Language (Swedish, Arabic RTL), English otherwise', async () => {
    fetchMock.mockImplementation(refused);
    const sv = await expectMaintenance(
      await proxy(req(`${uniq('down-l')}.localhost:3000`, '/', { 'accept-language': 'sv-SE,sv;q=0.9,en;q=0.8' })),
    );
    expect(sv).toContain('Vi är strax tillbaka');
    expect(sv).toContain('lang="sv"');
    expect(maintenanceLang('ar')).toBe('ar');
    expect(maintenanceLang('ja,zz')).toBe('en');
    expect(maintenanceLang(null)).toBe('en');
  });

  it('a real "no such store" answer keeps today\'s behaviour (no 503)', async () => {
    // Custom domain unknown to the API: falls through to the platform routes.
    fetchMock.mockImplementation(async () => json({ message: 'not found' }, 404));
    const custom = await proxy(req(`${uniq('nostore')}.example.se`, '/'));
    expect(custom.status).not.toBe(503);
    expect(custom.headers.get('retry-after')).toBeNull();
    // Platform subdomain whose market-context 404s: the legacy rewrite, so the
    // store layout answers its own 404.
    const sub = await proxy(req(`${uniq('nostore')}.localhost:3000`, '/'));
    expect(sub.status).not.toBe(503);
    expect(sub.headers.get('x-middleware-rewrite')).toContain('/store/nostore-');
  });

  it('a plain 500 is not treated as an outage (legacy fallback as before)', async () => {
    fetchMock.mockImplementation(async () => json({ message: 'boom' }, 500));
    const res = await proxy(req(`${uniq('err500')}.localhost:3000`, '/'));
    expect(res.status).not.toBe(503);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/store/err500-');
  });

  it('the outage is cached for 5 s only, then the store is back', async () => {
    const host = `${uniq('flap')}.localhost:3000`;
    const t0 = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0);
    fetchMock.mockImplementation(refused);
    await expectMaintenance(await proxy(req(host, '/')));
    await expectMaintenance(await proxy(req(host, '/')));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now.mockReturnValue(t0 + 5_001);
    fetchMock.mockImplementation(async () => json({ enabled: false }));
    const back = await proxy(req(host, '/'));
    expect(back.status).toBe(200);
    expect(back.headers.get('x-middleware-rewrite')).toContain('/store/flap-');
  });
});

describe('isDefinitiveNotFound (store layout)', () => {
  const err = (status?: number) => Object.assign(new Error('x'), status === undefined ? {} : { status });

  it('404 and other 4xx answers mean the store does not exist', () => {
    expect(isDefinitiveNotFound(err(404))).toBe(true);
    expect(isDefinitiveNotFound(err(400))).toBe(true);
    expect(isDefinitiveNotFound(err(403))).toBe(true);
  });

  it('network errors, unreadable 502 pages, 5xx, 408 and 429 do not', () => {
    expect(isDefinitiveNotFound(new TypeError('fetch failed'))).toBe(false);
    expect(isDefinitiveNotFound(new SyntaxError('Unexpected token <'))).toBe(false);
    for (const s of [500, 502, 503, 504, 408, 429]) expect(isDefinitiveNotFound(err(s))).toBe(false);
    expect(isDefinitiveNotFound(null)).toBe(false);
  });
});
