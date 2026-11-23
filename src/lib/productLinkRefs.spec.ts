import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import type { MarketRoute } from './market';
import { buildProductIdIndex, buildProductSlugIndex, canonicalizeProductUrl, type ProductLinkContext, type SitemapProductEntry } from './productLinkCanonical';
import {
  PRODUCT_REF_FALLBACK,
  hasProductRef,
  productRefSlug,
  resolveMenuProductRefs,
  resolveProductRef,
  resolveProductRefsInHtml,
  resolveSectionProductRefs,
  type ProductRefContext,
} from './productLinkRefs';
import { productRedirectSlug } from './productRedirect';
import { localizeStoreUrl } from './storeUrl';
import type { NavMenu, SectionInstance } from '@/themes/types';

// M165: `product:<id>` references resolve to the canonical product URL of the
// rendered locale / market, and the result is a fixed point of the M164
// redirect and of the typed-link rewrite (a click never hops).

const SIGN = '0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const LETTER = '1f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const DOOR = '2f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const BROKEN = '3f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const UNKNOWN = '9f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

const PRODUCTS: SitemapProductEntry[] = [
  {
    id: SIGN,
    slug: 'personal-3d-standing-name-sign',
    slugs: {
      sv: 'personlig-3d-staende-namnskylt',
      en: 'personal-3d-standing-name-sign',
      de: 'personalisiertes-freistehendes-3d-namensschild',
    },
  },
  // No en row (the live case).
  { id: LETTER, slug: '3d-bokstav-med-namn', slugs: { sv: '3d-bokstav-med-namn', de: '3d-buchstabe-mit-namen' } },
  // Non-ASCII slug + an ar slug (non-market multi-locale store).
  { id: DOOR, slug: 'skylt-för-dörr', slugs: { sv: 'skylt-för-dörr', en: 'door-sign', ar: 'لافتة-باب' } },
  // No usable slug at all.
  { id: BROKEN, slug: '-', slugs: { sv: '-' } },
  // No id (older API): skipped by the id index.
  { slug: 'no-id', slugs: { sv: 'no-id' } },
];
const idIndex = buildProductIdIndex(PRODUCTS);
const slugIndex = buildProductSlugIndex(PRODUCTS);
const ref = (id: string, tail = '') => `product:${id}${tail}`;

function marketCtx(market: MarketRoute, locale: string, extra: Partial<ProductRefContext> = {}): ProductRefContext {
  return {
    locale,
    primaryLocale: market.default_locale,
    secondaryLocales: market.locales,
    market,
    markets: [NAMEZ_SE, NAMEZ_EU],
    storeCustomDomain: null,
    idIndex,
    ...extra,
  };
}

const plainCtx = (locale: string, secondary: string[] = ['en', 'ar']): ProductRefContext => ({
  locale,
  primaryLocale: 'sv',
  secondaryLocales: secondary,
  market: null,
  markets: [],
  idIndex,
});

const prevWebUrl = process.env.NEXT_PUBLIC_WEB_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_WEB_URL = 'https://shopsdoor.com';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_WEB_URL = prevWebUrl;
});

describe('buildProductIdIndex', () => {
  it('keys by lowercase id, skips entries without id', () => {
    expect(idIndex.has(SIGN)).toBe(true);
    expect(idIndex.size).toBe(4);
    const upper = buildProductIdIndex([{ id: SIGN.toUpperCase(), slug: 'a' }]);
    expect(upper.get(SIGN)).toEqual([{ locale: null, slug: 'a' }]);
  });
});

describe('resolveProductRef per market slot (Namez)', () => {
  const cases: Array<{ name: string; ctx: ProductRefContext; id: string; slug: string; lp: string }> = [
    { name: 'namez.se sv root', ctx: marketCtx(NAMEZ_SE, 'sv'), id: SIGN, slug: 'personlig-3d-staende-namnskylt', lp: '' },
    { name: 'namez.shop en root', ctx: marketCtx(NAMEZ_EU, 'en'), id: SIGN, slug: 'personal-3d-standing-name-sign', lp: '' },
    { name: 'namez.shop /de-de', ctx: marketCtx(NAMEZ_EU, 'de'), id: SIGN, slug: 'personalisiertes-freistehendes-3d-namensschild', lp: '/de-de' },
    { name: 'namez.shop /de-at (slot locale de)', ctx: marketCtx(NAMEZ_EU, 'de'), id: SIGN, slug: 'personalisiertes-freistehendes-3d-namensschild', lp: '/de-at' },
    { name: 'namez.shop /ar without ar slug: market default', ctx: marketCtx(NAMEZ_EU, 'ar'), id: SIGN, slug: 'personal-3d-standing-name-sign', lp: '/ar' },
    { name: 'namez.shop en root, no en slug: first usable', ctx: marketCtx(NAMEZ_EU, 'en'), id: LETTER, slug: '3d-bokstav-med-namn', lp: '' },
    { name: 'review locale ku', ctx: marketCtx(NAMEZ_EU, 'ku'), id: SIGN, slug: 'personal-3d-standing-name-sign', lp: '/ku' },
    { name: 'noindex request', ctx: marketCtx(NAMEZ_EU, 'de', { noindex: true }), id: SIGN, slug: 'personalisiertes-freistehendes-3d-namensschild', lp: '/de-de' },
    {
      name: 'market preview',
      ctx: marketCtx({ ...NAMEZ_EU, preview: true }, 'de'),
      id: SIGN,
      slug: 'personalisiertes-freistehendes-3d-namensschild',
      lp: '/de-de',
    },
  ];

  for (const c of cases) {
    it(`${c.name}: right slug, fixed point of the redirect and of M164`, () => {
      const resolved = resolveProductRef(ref(c.id), c.ctx);
      expect(resolved).toBe(`/products/${c.slug}`);
      expect(localizeStoreUrl(resolved!, c.lp, c.ctx.locale)).toBe(`${c.lp}/products/${c.slug}`);
      const translations = idIndex.get(c.id)!;
      const store = {
        custom_domain: null,
        language_config: { primary_locale: c.ctx.primaryLocale, secondary_locales: c.ctx.secondaryLocales },
        market: c.ctx.market,
        markets: c.ctx.markets,
      };
      expect(
        productRedirectSlug({
          rawSlug: encodeURIComponent(c.slug),
          translations,
          store,
          locale: c.ctx.locale,
          allowLocaleRedirect: true,
          noindex: c.ctx.noindex,
        }),
      ).toBeNull();
      const typedCtx: ProductLinkContext = {
        locale: c.ctx.locale,
        primaryLocale: c.ctx.primaryLocale,
        secondaryLocales: c.ctx.secondaryLocales,
        market: c.ctx.market!,
        markets: c.ctx.markets,
        storeCustomDomain: null,
        noindex: c.ctx.noindex,
        index: slugIndex,
      };
      expect(canonicalizeProductUrl(resolved!, typedCtx)).toBe(resolved);
    });
  }

  it('non-market multi-locale store: the secondary locale slug', () => {
    expect(resolveProductRef(ref(DOOR), plainCtx('ar'))).toBe('/products/لافتة-باب');
    expect(resolveProductRef(ref(DOOR), plainCtx('en'))).toBe('/products/door-sign');
    // No own slug: the primary one (non-ASCII works).
    expect(resolveProductRef(ref(SIGN), plainCtx('ar'))).toBe('/products/personlig-3d-staende-namnskylt');
  });

  it('single-locale store', () => {
    expect(resolveProductRef(ref(SIGN), plainCtx('sv', []))).toBe('/products/personlig-3d-staende-namnskylt');
  });

  it('keeps the tail, ignores id case', () => {
    expect(resolveProductRef(ref(SIGN.toUpperCase(), '?variant=3#reviews'), plainCtx('en'))).toBe(
      '/products/personal-3d-standing-name-sign?variant=3#reviews',
    );
  });

  it('unknown id, no usable slug, other kinds: null', () => {
    expect(resolveProductRef(ref(UNKNOWN), plainCtx('sv'))).toBeNull();
    expect(resolveProductRef(ref(BROKEN), plainCtx('sv'))).toBeNull();
    expect(resolveProductRef(`collection:${SIGN}`, plainCtx('sv'))).toBeNull();
    expect(resolveProductRef('/products/x', plainCtx('sv'))).toBeNull();
  });

  it('productRefSlug: any usable slug for the preload', () => {
    expect(productRefSlug(SIGN, { idIndex, primaryLocale: 'sv', market: null, locale: 'de' })).toBe(
      'personalisiertes-freistehendes-3d-namensschild',
    );
    expect(productRefSlug(UNKNOWN, { idIndex, primaryLocale: 'sv', market: null, locale: 'de' })).toBeNull();
  });
});

const section = (key: string, settings: Record<string, unknown>, content: Record<string, unknown> = {}): SectionInstance => ({
  id: `s-${key}`,
  section_key: key,
  sort_order: 0,
  settings,
  translations: [{ locale: 'sv', content }],
});

describe('resolveSectionProductRefs', () => {
  const ctx = plainCtx('en');

  it('resolves whole values and HTML hrefs; unknown -> fallback; others unchanged', () => {
    const untouched = { title: 'x', cta_url: '/collections/a' };
    const sections = [
      section('hero-slider', { cta_url: ref(SIGN) }, { slides: [{ cta_url: ref(UNKNOWN) }, untouched] }),
      section('rich-text', {}, { html: `<p><a href="${ref(SIGN, '#r')}">a</a> <a href="/products/typed">b</a></p>` }),
      section('call-to-action', { cta_url: 'https://x.se' }),
    ];
    const out = resolveSectionProductRefs(sections, ctx);
    expect(out[0].settings.cta_url).toBe('/products/personal-3d-standing-name-sign');
    const slides = out[0].translations[0].content.slides as Array<Record<string, unknown>>;
    expect(slides[0].cta_url).toBe(PRODUCT_REF_FALLBACK);
    expect(slides[1]).toBe(untouched);
    expect(out[1].translations[0].content.html).toBe(
      '<p><a href="/products/personal-3d-standing-name-sign#r">a</a> <a href="/products/typed">b</a></p>',
    );
    // Copy-on-write: an untouched section keeps its identity.
    expect(out[2]).toBe(sections[2]);
  });

  it('no reference: same array', () => {
    const sections = [section('hero-slider', { cta_url: '/products/a' })];
    expect(resolveSectionProductRefs(sections, ctx)).toBe(sections);
  });

  it('pick fields of creative picked sections keep the reference, other fields resolve', () => {
    const sections = [
      section('cover-hero', { detail_url: ref(SIGN), cta_url: ref(SIGN) }),
      section('object-study', { product_url: ref(SIGN) }),
      section('look-spread', { link_url: ref(SIGN) }, { items: [{ url: ref(SIGN), title: 'x' }] }),
    ];
    const out = resolveSectionProductRefs(sections, ctx);
    expect(out[0].settings.detail_url).toBe(ref(SIGN));
    expect(out[0].settings.cta_url).toBe('/products/personal-3d-standing-name-sign');
    expect(out[1]).toBe(sections[1]);
    expect((out[2].translations[0].content.items as Array<Record<string, unknown>>)[0].url).toBe(ref(SIGN));
    expect(out[2].settings.link_url).toBe('/products/personal-3d-standing-name-sign');
  });
});

describe('resolveMenuProductRefs', () => {
  const menus: NavMenu[] = [
    {
      id: 'm',
      key: 'main',
      items: [
        { id: 'a', label: 'A', url: '/products/stored', kind: 'PRODUCT', resource_id: SIGN },
        { id: 'b', label: 'B', url: '/products/stored-b', kind: 'PRODUCT', resource_id: UNKNOWN },
        { id: 'c', label: 'C', url: ref(UNKNOWN), kind: 'CUSTOM' },
        { id: 'd', label: 'D', url: '/about', kind: 'CUSTOM' },
      ],
    } as NavMenu,
  ];

  it('known PRODUCT item resolves, unknown keeps its url, CUSTOM reference falls back', () => {
    const out = resolveMenuProductRefs(menus, marketCtx(NAMEZ_EU, 'de'));
    const items = out[0].items;
    expect(items[0].url).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    expect(items[1]).toBe(menus[0].items[1]);
    expect(items[2].url).toBe(PRODUCT_REF_FALLBACK);
    expect(items[3]).toBe(menus[0].items[3]);
  });

  it('no data: PRODUCT items keep their stored url', () => {
    const ctx = { ...plainCtx('en'), idIndex: new Map() };
    const out = resolveMenuProductRefs([{ ...menus[0], items: menus[0].items.slice(0, 2) }], ctx);
    expect(out[0].items.map((i) => i.url)).toEqual(['/products/stored', '/products/stored-b']);
  });
});

describe('resolveProductRefsInHtml / hasProductRef', () => {
  it('single and double quotes, uppercase scheme, unknown -> fallback', () => {
    const html = `<a href='${ref(SIGN)}'>a</a><a href="PRODUCT:${UNKNOWN}">b</a><a href="mailto:x@y.se">c</a>`;
    expect(resolveProductRefsInHtml(html, plainCtx('sv'))).toBe(
      `<a href='/products/personlig-3d-staende-namnskylt'>a</a><a href="/products">b</a><a href="mailto:x@y.se">c</a>`,
    );
  });
  it('localize (legacy static pages) prefixes resolved references only', () => {
    const html = `<a href="${ref(SIGN)}">a</a><a href="${ref(UNKNOWN)}">b</a><a href="/products/typed">c</a>`;
    expect(resolveProductRefsInHtml(html, plainCtx('sv'), (u) => localizeStoreUrl(u, '/ar', 'ar'))).toBe(
      `<a href="/ar/products/personlig-3d-staende-namnskylt">a</a><a href="/ar/products">b</a><a href="/products/typed">c</a>`,
    );
  });
  it('hasProductRef', () => {
    expect(hasProductRef({ a: [ref(SIGN)] })).toBe(true);
    expect(hasProductRef('/products/a')).toBe(false);
    expect(hasProductRef(null)).toBe(false);
  });
});
