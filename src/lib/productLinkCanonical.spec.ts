import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import type { MarketRoute } from './market';
import {
  buildProductSlugIndex,
  canonicalizeMenus,
  canonicalizeProductHtml,
  canonicalizeProductUrl,
  canonicalizeSectionLinks,
  type ProductLinkContext,
} from './productLinkCanonical';
import { productRedirectSlug } from './productRedirect';
import { slugRecordToTranslations } from './productPaths';
import type { NavMenu, SectionInstance } from '@/themes/types';

const SITEMAP_PRODUCTS: Array<{ slug: string; slugs: Record<string, string> }> = [
  {
    slug: 'personal-3d-standing-name-sign',
    slugs: {
      sv: 'personlig-3d-staende-namnskylt',
      en: 'personal-3d-standing-name-sign',
      de: 'personalisiertes-freistehendes-3d-namensschild',
    },
  },
  // The live case: no en row.
  { slug: '3d-bokstav-med-namn', slugs: { sv: '3d-bokstav-med-namn', de: '3d-buchstabe-mit-namen' } },
  { slug: 'skylt-för-dörr', slugs: { sv: 'skylt-för-dörr', en: 'door-sign' } },
  // Two products sharing a slug: ambiguous, never rewritten.
  { slug: 'shared-a', slugs: { sv: 'delad', en: 'shared-a' } },
  { slug: 'shared-b', slugs: { sv: 'delad', en: 'shared-b' } },
];
const index = buildProductSlugIndex(SITEMAP_PRODUCTS);

function ctxFor(market: MarketRoute, locale: string, extra: Partial<ProductLinkContext> = {}): ProductLinkContext {
  return {
    locale,
    primaryLocale: market.default_locale,
    secondaryLocales: market.locales,
    market,
    markets: [NAMEZ_SE, NAMEZ_EU],
    storeCustomDomain: null,
    index,
    ...extra,
  };
}

const DE = ctxFor(NAMEZ_EU, 'de');
const EN = ctxFor(NAMEZ_EU, 'en');
const SV = ctxFor(NAMEZ_SE, 'sv');

const prevWebUrl = process.env.NEXT_PUBLIC_WEB_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_WEB_URL = 'https://shopsdoor.com';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_WEB_URL = prevWebUrl;
});

describe('buildProductSlugIndex', () => {
  it('maps every slug to its product and drops ambiguous slugs', () => {
    expect(index.get('personlig-3d-staende-namnskylt')).toEqual(slugRecordToTranslations(SITEMAP_PRODUCTS[0].slugs));
    expect(index.get('door-sign')).toBeDefined();
    expect(index.has('delad')).toBe(false);
    expect(index.has('shared-a')).toBe(true);
  });
});

describe('canonicalizeProductUrl: accepted forms', () => {
  it('relative without prefix: the page locale (the renderer adds the prefix later)', () => {
    expect(canonicalizeProductUrl('/products/personlig-3d-staende-namnskylt', DE)).toBe(
      '/products/personalisiertes-freistehendes-3d-namensschild',
    );
    expect(canonicalizeProductUrl('/products/personlig-3d-staende-namnskylt', EN)).toBe('/products/personal-3d-standing-name-sign');
    expect(canonicalizeProductUrl('/products/personal-3d-standing-name-sign', SV)).toBe('/products/personlig-3d-staende-namnskylt');
  });

  it('the live hero links on namez.shop/de-de', () => {
    expect(canonicalizeProductUrl('/de-de/products/personlig-3d-staende-namnskylt', DE)).toBe(
      '/de-de/products/personalisiertes-freistehendes-3d-namensschild',
    );
    expect(canonicalizeProductUrl('/de-de/products/3d-bokstav-med-namn', DE)).toBe('/de-de/products/3d-buchstabe-mit-namen');
  });

  it('explicit prefix wins over the page locale (bare /<locale>, ll-cc, other slot)', () => {
    expect(canonicalizeProductUrl('/de-at/products/personlig-3d-staende-namnskylt', EN)).toBe(
      '/de-at/products/personalisiertes-freistehendes-3d-namensschild',
    );
    expect(canonicalizeProductUrl('/de/products/personlig-3d-staende-namnskylt', EN)).toBe(
      '/de/products/personalisiertes-freistehendes-3d-namensschild',
    );
    expect(canonicalizeProductUrl('/en/products/personlig-3d-staende-namnskylt', SV)).toBe('/en/products/personal-3d-standing-name-sign');
  });

  it('query, hash and trailing slash', () => {
    expect(canonicalizeProductUrl('/products/personlig-3d-staende-namnskylt?variant=1&utm_source=x#reviews', DE)).toBe(
      '/products/personalisiertes-freistehendes-3d-namensschild?variant=1&utm_source=x#reviews',
    );
    expect(canonicalizeProductUrl('/products/personlig-3d-staende-namnskylt/', DE)).toBe(
      '/products/personalisiertes-freistehendes-3d-namensschild',
    );
  });

  it('absolute: current market host keeps host, root = market default locale', () => {
    expect(canonicalizeProductUrl('https://namez.shop/products/personlig-3d-staende-namnskylt', DE)).toBe(
      'https://namez.shop/products/personal-3d-standing-name-sign',
    );
    expect(canonicalizeProductUrl('https://www.namez.shop/de-de/products/3d-bokstav-med-namn?x=1', EN)).toBe(
      'https://www.namez.shop/de-de/products/3d-buchstabe-mit-namen?x=1',
    );
  });

  it('absolute: another market host uses that market', () => {
    expect(canonicalizeProductUrl('https://namez.se/products/personal-3d-standing-name-sign', DE)).toBe(
      'https://namez.se/products/personlig-3d-staende-namnskylt',
    );
    expect(canonicalizeProductUrl('https://namez.shop/de-at/products/door-sign', SV)).toBe('https://namez.shop/de-at/products/door-sign');
  });

  it('absolute: non-ASCII slug / query keep the host and the typed query', () => {
    expect(canonicalizeProductUrl('https://namez.shop/products/skylt-för-dörr', SV)).toBe('https://namez.shop/products/door-sign');
    expect(canonicalizeProductUrl('https://namez.se/products/door-sign?c=ä#x', SV)).toBe('https://namez.se/products/skylt-för-dörr?c=ä#x');
    expect(canonicalizeProductUrl('HTTPS://NAMEZ.SE/products/door-sign?q=jul rea', SV)).toBe(
      'HTTPS://NAMEZ.SE/products/skylt-för-dörr?q=jul rea',
    );
  });

  it('absolute: platform subdomain becomes a relative path of the current market', () => {
    expect(canonicalizeProductUrl('https://namez-se.shopsdoor.com/products/personlig-3d-staende-namnskylt', DE)).toBe(
      '/products/personalisiertes-freistehendes-3d-namensschild',
    );
  });

  it('legacy custom domain = the default market host', () => {
    const se = { ...NAMEZ_SE, primary_hostname: null };
    const ctx = ctxFor(NAMEZ_EU, 'de', { markets: [se, NAMEZ_EU], storeCustomDomain: 'resumely.net' });
    expect(canonicalizeProductUrl('https://resumely.net/products/personal-3d-standing-name-sign', ctx)).toBe(
      'https://resumely.net/products/personlig-3d-staende-namnskylt',
    );
  });

  it('letter case of the typed slug is fixed too', () => {
    expect(canonicalizeProductUrl('/products/Door-Sign', EN)).toBe('/products/door-sign');
  });
});

describe('canonicalizeProductUrl: untouched forms', () => {
  const same = (url: string, ctx = DE) => expect(canonicalizeProductUrl(url, ctx)).toBe(url);

  it('external hosts, mailto, other paths, listing queries', () => {
    same('https://example.com/products/personlig-3d-staende-namnskylt');
    same('mailto:a@b.se');
    same('/collections/personlig-3d-staende-namnskylt');
    same('/products?q=personlig');
    same('/products');
    same('/products/personlig-3d-staende-namnskylt/reviews');
    same('//namez.shop/products/personlig-3d-staende-namnskylt');
    same('#top');
  });

  it('unknown and ambiguous slugs', () => {
    same('/products/not-a-product');
    same('/products/delad');
  });

  it('prefix the market does not serve', () => {
    same('/fr/products/personal-3d-standing-name-sign', SV);
    same('/xx-yy/products/personal-3d-standing-name-sign');
  });

  it('already canonical: byte-identical (same string)', () => {
    same('/products/personalisiertes-freistehendes-3d-namensschild');
    same('/de-de/products/3d-buchstabe-mit-namen?utm=1');
    same('https://namez.se/products/personlig-3d-staende-namnskylt');
  });

  it('self-canonical fallback: no slug for the locale nor the market default', () => {
    // namez.shop root (en) for a product without en: market default en is missing too.
    same('/products/3d-bokstav-med-namn', EN);
    same('/products/3d-buchstabe-mit-namen', EN);
  });
});

describe('rewritten links never redirect (link = page canonical)', () => {
  it('every slug on every slot', () => {
    const cases: Array<[ProductLinkContext, string]> = [
      [DE, ''],
      [EN, ''],
      [SV, ''],
      [ctxFor(NAMEZ_EU, 'ar'), ''],
      [ctxFor(NAMEZ_SE, 'en'), ''],
    ];
    for (const [ctx] of cases) {
      for (const p of SITEMAP_PRODUCTS.slice(0, 3)) {
        const translations = slugRecordToTranslations(p.slugs);
        for (const slug of Object.values(p.slugs)) {
          const out = canonicalizeProductUrl(`/products/${slug}`, ctx);
          const landed = out.split('/products/')[1]!;
          const store = {
            language_config: { primary_locale: ctx.primaryLocale, secondary_locales: ctx.secondaryLocales },
            market: ctx.market,
            markets: ctx.markets,
          };
          expect(
            productRedirectSlug({ rawSlug: encodeURIComponent(landed), translations, store, locale: ctx.locale, allowLocaleRedirect: true }),
            `${ctx.market.key}/${ctx.locale} ${slug} -> ${landed}`,
          ).toBeNull();
        }
      }
    }
  });
});

describe('canonicalizeProductHtml', () => {
  it('rewrites href values in both quote styles and leaves text alone', () => {
    const html =
      '<p>See /products/personlig-3d-staende-namnskylt <a href="/products/personlig-3d-staende-namnskylt">one</a> ' +
      "<a class='x' href='/de-de/products/3d-bokstav-med-namn?a=1&amp;b=2'>two</a> <a href=\"https://example.com/products/door-sign\">ext</a></p>";
    expect(canonicalizeProductHtml(html, DE)).toBe(
      '<p>See /products/personlig-3d-staende-namnskylt <a href="/products/personalisiertes-freistehendes-3d-namensschild">one</a> ' +
        "<a class='x' href='/de-de/products/3d-buchstabe-mit-namen?a=1&amp;b=2'>two</a> <a href=\"https://example.com/products/door-sign\">ext</a></p>",
    );
  });

  it('returns the same string when nothing changes', () => {
    const html = '<a href="/collections/x">x</a>';
    expect(canonicalizeProductHtml(html, DE)).toBe(html);
  });
});

describe('canonicalizeSectionLinks', () => {
  const hero: SectionInstance = {
    id: 'hero',
    section_key: 'hero-slider',
    sort_order: 0,
    settings: { autoplay: true, slides: [{ image: '/uploads/products/a.jpg', button_url: '/de-de/products/personlig-3d-staende-namnskylt' }] },
    translations: [
      {
        locale: 'de',
        content: {
          cta: { label: 'Jetzt', url: '/products/3d-bokstav-med-namn' },
          body: '<p><a href="/products/door-sign">x</a></p>',
          doc: { type: 'doc', content: [{ type: 'text', marks: [{ type: 'link', attrs: { href: '/products/skylt-för-dörr' } }] }] },
          title: 'Ein Text mit /products/personlig-3d-staende-namnskylt darin',
        },
      },
    ],
  };
  const untouched: SectionInstance = {
    id: 'text',
    section_key: 'rich-text',
    sort_order: 1,
    settings: { url: '/collections/x' },
    translations: [{ locale: 'de', content: { url: '/products/personalisiertes-freistehendes-3d-namensschild' } }],
  };

  it('rewrites settings + content (button, CTA, rich text, tiptap link) and keeps identity elsewhere', () => {
    const [h, u] = canonicalizeSectionLinks([hero, untouched], DE);
    expect(u).toBe(untouched);
    expect(h).not.toBe(hero);
    const slides = h.settings.slides as Array<Record<string, string>>;
    expect(slides[0].button_url).toBe('/de-de/products/personalisiertes-freistehendes-3d-namensschild');
    expect(slides[0].image).toBe('/uploads/products/a.jpg');
    const c = h.translations[0].content as Record<string, any>;
    expect(c.cta.url).toBe('/products/3d-buchstabe-mit-namen');
    expect(c.body).toBe('<p><a href="/products/door-sign">x</a></p>');
    expect(c.doc.content[0].marks[0].attrs.href).toBe('/products/door-sign');
    // Prose that mentions a path is not a link.
    expect(c.title).toBe(hero.translations[0].content.title);
    // The input is not mutated.
    expect((hero.settings.slides as Array<Record<string, string>>)[0].button_url).toBe('/de-de/products/personlig-3d-staende-namnskylt');
  });

  it('returns the same array when nothing changes', () => {
    const list = [untouched];
    expect(canonicalizeSectionLinks(list, DE)).toBe(list);
  });

  it('creative picked sections keep a url the preload can read (no non-ASCII canonical)', () => {
    const study: SectionInstance = {
      id: 'study',
      section_key: 'object-study',
      sort_order: 0,
      settings: { product_url: '/products/door-sign' },
      translations: [],
    };
    const cover: SectionInstance = {
      id: 'cover',
      section_key: 'cover-hero',
      sort_order: 1,
      settings: { detail_url: '/products/personal-3d-standing-name-sign' },
      translations: [],
    };
    const plain: SectionInstance = { ...study, id: 'plain', section_key: 'hero-slider' };
    const [s, c, p] = canonicalizeSectionLinks([study, cover, plain], SV);
    // `skylt-för-dörr` is not readable by productSlugFromUrl: the typed url stays.
    expect(s).toBe(study);
    // ASCII canonical: rewritten as anywhere else.
    expect(c.settings.detail_url).toBe('/products/personlig-3d-staende-namnskylt');
    expect(p.settings.product_url).toBe('/products/skylt-för-dörr');
  });
});

describe('canonicalizeMenus', () => {
  it('rewrites item urls, keeps identity of untouched menus', () => {
    const main: NavMenu = {
      id: '1',
      key: 'main',
      name: 'Main',
      items: [
        { id: 'a', label: 'Skylt', url: '/products/personlig-3d-staende-namnskylt', kind: 'PRODUCT' },
        { id: 'b', label: 'Om', url: '/pages/om' },
      ],
    };
    const footer: NavMenu = { id: '2', key: 'footer', name: 'Footer', items: [{ id: 'c', label: 'X', url: '/collections/x' }] };
    const out = canonicalizeMenus([main, footer], DE);
    expect(out[0].items[0].url).toBe('/products/personalisiertes-freistehendes-3d-namensschild');
    expect(out[0].items[1]).toBe(main.items[1]);
    expect(out[1]).toBe(footer);
    const same = [footer];
    expect(canonicalizeMenus(same, DE)).toBe(same);
  });
});
