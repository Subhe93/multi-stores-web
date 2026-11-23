import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import type { SectionInstance } from '@/themes/types';

// Server wiring of M164 part 2: the rewriter is the identity (and reads
// nothing) without a market, on a market preview and on a focused store;
// with a market it reads the sitemap data once, lazily.

const SIGN = '0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const UNKNOWN = '9f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

const state = {
  market: { key: 'eu' } as { key: string; preview?: true } | undefined,
  focused: false,
  sitemapFails: false,
};

const getSitemapData = vi.fn(async () => {
  if (state.sitemapFails) throw new Error('api down');
  return {
    products: [
      {
        id: SIGN,
        slug: 'personal-3d-standing-name-sign',
        slugs: {
          sv: 'personlig-3d-staende-namnskylt',
          en: 'personal-3d-standing-name-sign',
          de: 'personalisiertes-freistehendes-3d-namensschild',
        },
      },
    ],
  };
});

vi.mock('server-only', () => ({}));
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
vi.mock('./api', () => ({ storefront: { getSitemapData: (...a: unknown[]) => getSitemapData(...(a as [])) } }));
vi.mock('./market.server', () => ({
  getRequestMarket: async () => state.market,
  getRequestNoindex: async () => false,
}));
vi.mock('./focusedStorefront.server', () => ({
  requestFocusedStorefront: async () => (state.focused ? { url: 'https://site.example' } : null),
}));

const { productLinkRewriter } = await import('./productLinkCanonical.server');

const marketStore = {
  language_config: { primary_locale: 'en', secondary_locales: NAMEZ_EU.locales },
  market: NAMEZ_EU,
  markets: [NAMEZ_SE, NAMEZ_EU],
};
const section = (url: string): SectionInstance => ({
  id: 's',
  section_key: 'hero-slider',
  sort_order: 0,
  settings: { url },
  translations: [],
});

beforeEach(() => {
  getSitemapData.mockClear();
  state.market = { key: 'eu' };
  state.focused = false;
  state.sitemapFails = false;
});

describe('productLinkRewriter', () => {
  it('no market: identity, no read (single- and multi-locale stores)', async () => {
    state.market = undefined;
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    for (const store of [{ language_config: { primary_locale: 'sv', secondary_locales: ['en'] } }, null]) {
      const rw = await productLinkRewriter('anna', store, 'en');
      expect(await rw.sections(sections)).toBe(sections);
      expect(await rw.html('<a href="/products/personlig-3d-staende-namnskylt">x</a>')).toBe(
        '<a href="/products/personlig-3d-staende-namnskylt">x</a>',
      );
    }
    expect(getSitemapData).not.toHaveBeenCalled();
  });

  it('market preview and focused store: identity, no read', async () => {
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    state.market = { key: 'eu', preview: true };
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
    state.market = { key: 'eu' };
    state.focused = true;
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
    expect(getSitemapData).not.toHaveBeenCalled();
  });

  it('market store: no candidate -> no read; candidate -> rewritten', async () => {
    const rw = await productLinkRewriter('namez-se', marketStore, 'de');
    const plain = [section('/collections/x')];
    expect(await rw.sections(plain)).toBe(plain);
    expect(getSitemapData).not.toHaveBeenCalled();
    const out = await rw.sections([section('/de-de/products/personlig-3d-staende-namnskylt')]);
    expect(out[0].settings.url).toBe('/de-de/products/personalisiertes-freistehendes-3d-namensschild');
    expect(getSitemapData).toHaveBeenCalledWith('namez-se', { key: 'eu' });
  });

  it('read failure: links render as typed', async () => {
    state.sitemapFails = true;
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
  });

  // M165: product references (pass 1) run on every store.
  it('reference on a non-market store resolves (sitemap read without market)', async () => {
    state.market = undefined;
    const rw = await productLinkRewriter('anna', { language_config: { primary_locale: 'sv', secondary_locales: ['en', 'de'] } }, 'de');
    const out = await rw.sections([section(`product:${SIGN}`)]);
    expect(out[0].settings.url).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    expect(getSitemapData).toHaveBeenCalledWith('anna');
    expect(await rw.html(`<a href="product:${SIGN}">x</a>`)).toBe('<a href="/products/personalisiertes-freistehendes-3d-namensschild">x</a>');
    expect(await rw.refSlug(SIGN)).toBe('personalisiertes-freistehendes-3d-namensschild');
  });

  it('reference on a focused store and on a market preview resolves', async () => {
    state.focused = true;
    let rw = await productLinkRewriter('namez-se', marketStore, 'de');
    expect((await rw.refs([section(`product:${SIGN}`)]))[0].settings.url).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    // Typed links stay as typed on a focused store.
    const typed = [section('/products/personlig-3d-staende-namnskylt')];
    expect(await rw.sections(typed)).toBe(typed);
    state.focused = false;
    state.market = { key: 'eu', preview: true };
    rw = await productLinkRewriter('namez-se', { ...marketStore, market: { ...marketStore.market, preview: true } }, 'de');
    expect((await rw.sections([section(`product:${SIGN}`)]))[0].settings.url).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    expect(getSitemapData).toHaveBeenCalledWith('namez-se', { key: 'eu', preview: true });
  });

  it('reference + typed link in one market section: both passes', async () => {
    const rw = await productLinkRewriter('namez-se', marketStore, 'de');
    const out = await rw.sections([
      { ...section(`product:${UNKNOWN}`), translations: [{ locale: 'de', content: { b: '/products/personlig-3d-staende-namnskylt' } }] },
    ]);
    expect(out[0].settings.url).toBe('/products');
    expect(out[0].translations[0].content.b).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    // Both passes ask for the same cache entry (React `cache` dedupes it in a request).
    for (const call of getSitemapData.mock.calls as unknown[][]) expect(call).toEqual(['namez-se', { key: 'eu' }]);
  });

  it('read failure: references fall back to /products, PRODUCT menu items keep their url', async () => {
    state.sitemapFails = true;
    state.market = undefined;
    const rw = await productLinkRewriter('anna', null, 'sv');
    expect((await rw.sections([section(`product:${SIGN}`)]))[0].settings.url).toBe('/products');
    const menus = [
      { id: 'm', key: 'main', name: 'Main', items: [{ id: 'a', label: 'A', url: '/products/stored', kind: 'PRODUCT' as const, resource_id: SIGN }] },
    ];
    expect((await rw.menus(menus))![0].items[0].url).toBe('/products/stored');
    expect(await rw.refSlug(SIGN)).toBeNull();
  });

  it('PRODUCT menu items resolve per locale; unknown resource keeps its url', async () => {
    state.market = undefined;
    const rw = await productLinkRewriter('anna', { language_config: { primary_locale: 'sv', secondary_locales: ['en'] } }, 'en');
    const menus = [
      {
        id: 'm',
        key: 'main',
        name: 'Main',
        items: [
          { id: 'a', label: 'A', url: '/products/personlig-3d-staende-namnskylt', kind: 'PRODUCT' as const, resource_id: SIGN },
          { id: 'b', label: 'B', url: '/products/gone', kind: 'PRODUCT' as const, resource_id: UNKNOWN },
        ],
      },
    ];
    const out = await rw.menus(menus);
    expect(out![0].items.map((i) => i.url)).toEqual(['/products/personal-3d-standing-name-sign', '/products/gone']);
  });

  it('pick fields keep the reference for the preload', async () => {
    state.market = undefined;
    const rw = await productLinkRewriter('anna', null, 'sv');
    const s: SectionInstance = { ...section(''), section_key: 'cover-hero', settings: { detail_url: `product:${SIGN}` } };
    const out = await rw.sections([s]);
    expect(out[0]).toBe(s);
  });
});
