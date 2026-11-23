// Owner-typed product links -> canonical product URL (M164 part 2).
//
// Section content, menus and rich text hold links the owner typed by hand:
// `/products/<slug>`, `/de-de/products/<slug>`, `https://namez.shop/products/
// <slug>`. A product resolves by any of its translated slugs, so a Swedish
// slug typed into the hero of the German page still opens the product, but
// through the M164 redirect. This module rewrites such a link to the slug of
// the canonical of the page it opens (the same `productCanonicalSlug` the
// product page redirects to), so the click needs no hop.
//
// Only the slug segment changes: prefix, host, query and hash are kept, and
// every string that is not a recognised product link of this store is
// returned unchanged (by reference for objects). Pure: no `next/*`.

import type { MarketRoute } from './market';
import type { NavMenu, SectionInstance } from '@/themes/types';
import { stripStorePrefix } from './localePaths';
import { productCanonicalSlug, slugRecordToTranslations, type ProductSlugTranslation } from './productPaths';
import { decodeRouteParam } from './slugRoute';
import { marketPublicHostname, storeHref } from './storeUrl';
import { normalizeSlugForLookup } from '@multi-stores/core/slug';
import { PICKED_SECTION_KEYS, productSlugFromUrl } from '@/themes/creative/data/pickedProducts';

/** One product of `GET /storefront/:slug/sitemap-data?market=` (M161). */
export interface SitemapProductEntry {
  slug?: string | null;
  slugs?: Record<string, string> | null;
}

/** Lookup slug -> every translation slug of the one product that owns it. */
export type ProductSlugIndex = Map<string, ProductSlugTranslation[]>;

export interface ProductLinkContext {
  /** Locale of the rendered page. */
  locale: string;
  /** Store primary locale of the request (store payload `language_config`). */
  primaryLocale: string;
  secondaryLocales: string[];
  /** Market of the request. */
  market: MarketRoute;
  /** Every LIVE market (other-market hosts are recognised too). */
  markets: MarketRoute[];
  /** Legacy `Store.custom_domain` (the default market's host). */
  storeCustomDomain?: string | null;
  /** The proxy's noindex verdict of the request (same input as the redirect). */
  noindex?: boolean;
  index: ProductSlugIndex;
}

/**
 * Index of the sitemap products: every slug (lookup form) maps to the
 * translations of its product. A slug shared by two products is ambiguous
 * and dropped, so its links stay as typed.
 */
export function buildProductSlugIndex(products: readonly SitemapProductEntry[] | null | undefined): ProductSlugIndex {
  const index: ProductSlugIndex = new Map();
  const ambiguous = new Set<string>();
  for (const p of products ?? []) {
    const translations = p.slugs && Object.keys(p.slugs).length > 0 ? slugRecordToTranslations(p.slugs) : [];
    const keys = new Set<string>();
    for (const tr of translations) if (tr.slug) keys.add(normalizeSlugForLookup(tr.slug));
    if (p.slug) keys.add(normalizeSlugForLookup(p.slug));
    for (const key of keys) {
      if (!key) continue;
      if (index.has(key)) ambiguous.add(key);
      else index.set(key, translations);
    }
  }
  for (const key of ambiguous) index.delete(key);
  return index;
}

const cleanHost = (h: string) => h.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

/** Market served on `host` (public hostname or legacy custom domain), or null. */
function marketOfHost(host: string, ctx: ProductLinkContext): MarketRoute | null {
  const h = cleanHost(host);
  const all = [ctx.market, ...ctx.markets.filter((m) => m.key !== ctx.market.key)];
  for (const m of all) {
    const own = marketPublicHostname(m, ctx.storeCustomDomain ?? null);
    if (own && cleanHost(own) === h) return m.key === ctx.market.key ? ctx.market : m;
  }
  return null;
}

function splitTail(s: string): [string, string] {
  const cut = s.search(/[?#]/);
  return cut < 0 ? [s, ''] : [s.slice(0, cut), s.slice(cut)];
}

const PRODUCT_PATH_RE = /^\/products\/([^/]+)\/?$/;

/**
 * Canonical form of one owner-typed link (see the module comment). The
 * input string is returned unchanged unless the slug changes.
 */
export function canonicalizeProductUrl(url: string, ctx: ProductLinkContext): string {
  if (typeof url !== 'string' || !url.includes('/products/')) return url;
  const trimmed = url.trim();
  // A platform host becomes a relative path (the same step the renderers'
  // localizeStoreUrl takes); another host must be one of the store's markets.
  const relative = storeHref(trimmed);
  let origin = '';
  let market = ctx.market;
  let rest = relative;
  if (/^https?:\/\//i.test(relative)) {
    let parsed: URL;
    try {
      parsed = new URL(relative);
    } catch {
      return url;
    }
    const hostMarket = marketOfHost(parsed.hostname, ctx);
    if (!hostMarket) return url;
    market = hostMarket;
    // Split the typed string itself, not the parsed URL: URL re-encodes
    // non-ASCII path / query characters, so its lengths do not match the raw
    // text (slicing by them cut the host off). Path, query and hash stay as typed.
    origin = /^https?:\/\/[^/?#]*/i.exec(relative)?.[0] ?? '';
    if (!origin) return url;
    rest = relative.slice(origin.length) || '/';
  } else if (!relative.startsWith('/') || relative.startsWith('//')) {
    return url;
  }

  const [path, tail] = splitTail(rest);
  const current = market.key === ctx.market.key;
  const marketLocales = Array.from(new Set([market.default_locale, ...(market.locales ?? [])]));
  const { prefix, rest: sub } = stripStorePrefix(path, market, marketLocales);
  // Locale the link opens: its explicit prefix; else the page locale for a
  // relative link (the renderer adds the current prefix later) or the
  // market's root locale for an absolute one.
  let targetLocale: string;
  if (prefix) {
    const seg = prefix.slice(1);
    const slot = (market.locale_paths ?? []).find((r) => r.path === seg);
    targetLocale = slot ? slot.locale : seg;
  } else {
    targetLocale = origin || !current ? market.default_locale : ctx.locale;
  }

  const hit = PRODUCT_PATH_RE.exec(sub);
  if (!hit) return url;
  const typed = decodeRouteParam(hit[1]);
  const translations = ctx.index.get(normalizeSlugForLookup(typed));
  if (!translations) return url;
  const matched = translations.find((tr) => tr.slug && normalizeSlugForLookup(tr.slug) === normalizeSlugForLookup(typed))?.slug;
  if (!matched) return url;

  const store = current
    ? {
        custom_domain: ctx.storeCustomDomain ?? null,
        language_config: { primary_locale: ctx.primaryLocale, secondary_locales: ctx.secondaryLocales },
        market: ctx.market,
        markets: ctx.markets,
      }
    : {
        custom_domain: ctx.storeCustomDomain ?? null,
        language_config: { primary_locale: market.default_locale, secondary_locales: market.locales ?? [] },
        market,
        markets: ctx.markets,
      };
  const canon = productCanonicalSlug({
    store,
    translations,
    matchedSlug: matched,
    locale: targetLocale,
    noindex: current ? ctx.noindex : false,
  });
  if (!canon || canon === typed) return url;
  // Same shape, only the slug replaced (raw, like productLinkPath).
  return `${origin}${prefix}/products/${canon}${tail}`;
}

/** Every `href="…"` / `href='…'` value of owner HTML through `canonicalizeProductUrl`. */
export function canonicalizeProductHtml(html: string, ctx: ProductLinkContext): string {
  if (typeof html !== 'string' || !html.includes('/products/')) return html;
  return html.replace(/(\shref\s*=\s*)(["'])([^"']*)\2/gi, (whole, attr: string, quote: string, value: string) => {
    const next = canonicalizeProductUrl(value, ctx);
    return next === value ? whole : `${attr}${quote}${next}${quote}`;
  });
}

/**
 * A string value of section content: a whole product URL, or HTML with hrefs.
 * `keepPicks` (creative picked-product sections): a url the server preload
 * can read (`productSlugFromUrl`, ASCII slugs only) is never turned into one
 * it cannot read (a non-ASCII canonical slug), or the live product card would
 * vanish. Those sections already link the canonical of a picked product (M163).
 */
function canonicalizeString(value: string, ctx: ProductLinkContext, keepPicks: boolean): string {
  if (!value.includes('/products/')) return value;
  if (/\shref\s*=/i.test(value)) return canonicalizeProductHtml(value, ctx);
  if (/\s/.test(value.trim())) return value;
  const next = canonicalizeProductUrl(value, ctx);
  if (keepPicks && next !== value && productSlugFromUrl(value) && !productSlugFromUrl(next)) return value;
  return next;
}

/** Copy-on-write deep walk: unchanged branches keep their identity. */
function walk(value: unknown, ctx: ProductLinkContext, keepPicks = false): unknown {
  if (typeof value === 'string') return canonicalizeString(value, ctx, keepPicks);
  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    value.forEach((item, i) => {
      const next = walk(item, ctx, keepPicks);
      if (next !== item) {
        out ??= value.slice();
        out[i] = next;
      }
    });
    return out ?? value;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let out: Record<string, unknown> | null = null;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = walk(item, ctx, keepPicks);
      if (next !== item) {
        out ??= { ...(value as Record<string, unknown>) };
        out[key] = next;
      }
    }
    return out ?? value;
  }
  return value;
}

/** Product links of every section's settings and content rows (all themes). */
export function canonicalizeSectionLinks(sections: SectionInstance[], ctx: ProductLinkContext): SectionInstance[] {
  let out: SectionInstance[] | null = null;
  sections.forEach((section, i) => {
    const keepPicks = (PICKED_SECTION_KEYS as readonly string[]).includes(section?.section_key);
    const next = walk(section, ctx, keepPicks) as SectionInstance;
    if (next !== section) {
      out ??= sections.slice();
      out[i] = next;
    }
  });
  return out ?? sections;
}

/** `items[].url` of every menu (CUSTOM and PRODUCT kinds alike). */
export function canonicalizeMenus(menus: NavMenu[], ctx: ProductLinkContext): NavMenu[] {
  let changed = false;
  const out = menus.map((menu) => {
    let itemsChanged = false;
    const items = (menu.items ?? []).map((item) => {
      const url = typeof item.url === 'string' ? canonicalizeProductUrl(item.url, ctx) : item.url;
      if (url === item.url) return item;
      itemsChanged = true;
      return { ...item, url };
    });
    if (!itemsChanged) return menu;
    changed = true;
    return { ...menu, items };
  });
  return changed ? out : menus;
}
