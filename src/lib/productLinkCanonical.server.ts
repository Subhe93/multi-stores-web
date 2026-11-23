import 'server-only';
import { cache } from 'react';
import { storefront } from './api';
import { requestFocusedStorefront } from './focusedStorefront.server';
import type { MarketRef, MarketRoute } from './market';
import { getRequestMarket, getRequestNoindex, getRequestRedirectsVersion } from './market.server';
import { localizeStoreUrl, marketPublicHostname } from './storeUrl';
import { headers } from 'next/headers';
import { storeRedirectMap } from './redirects';
import { usesLocalePaths, type PathMarket } from './localePaths';
import {
  canonicalizeRedirectHtml,
  canonicalizeRedirectMenus,
  canonicalizeRedirectSections,
  type RedirectLinkContext,
} from './redirectLinkCanonical';
import {
  buildProductIdIndex,
  buildProductSlugIndex,
  canonicalizeMenus,
  canonicalizeProductHtml,
  canonicalizeSectionLinks,
  type ProductIdIndex,
  type ProductLinkContext,
  type ProductSlugIndex,
  type SitemapProductEntry,
} from './productLinkCanonical';
import {
  hasProductRef,
  productRefSlug,
  resolveMenuProductRefs,
  resolveProductRefsInHtml,
  resolveSectionProductRefs,
  type ProductRefContext,
} from './productLinkRefs';
import type { NavMenu, SectionInstance } from '@/themes/types';

// Server wiring of the storefront link rewrite. Runs before any section,
// menu or HTML reaches a client component (no hydration mismatch, no slug or
// id map in the browser). Two passes:
//
//  1. M165 product references (`product:<id>`, PRODUCT menu items): every
//     store, previews and focused storefronts included, because a reference
//     must never reach the browser unresolved. Content without a reference
//     performs no read and is returned as is.
//  2. M164 owner-typed product links (`/products/<slug>`): LIVE market of a
//     store that is not a focused storefront only (identity otherwise).
//  3. M166 D1 permanent store redirects: a typed link whose path the proxy
//     would 301/308 (`/shipping-policy` -> `/legal/shipping`) points at the
//     target directly. Only when the proxy forwarded the store's
//     `redirects_version` (stores with redirects) and the table is served
//     whole (map mode); runs last, one hop, never re-fed.
//
// The data is the sitemap-data read (store tag, same cache entry as
// sitemap.xml), fetched lazily and once per request and market.

/** The slice of the storefront store payload the rewrite needs. */
export interface ProductLinkStore {
  custom_domain?: string | null;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  market?: MarketRoute | null;
  markets?: MarketRoute[];
  checkout?: unknown;
}

export interface ProductLinkRewriter {
  /** Both passes over section settings and content. */
  sections<T extends SectionInstance[] | null | undefined>(sections: T): Promise<T>;
  /** Pass 1 only (focused storefront templates keep typed links as typed). */
  refs<T extends SectionInstance[] | null | undefined>(sections: T): Promise<T>;
  menus<T extends NavMenu[] | null | undefined>(menus: T): Promise<T>;
  /**
   * Both passes over owner HTML. `prefix` (the request link prefix, e.g.
   * `/ar` or `/de-de`) is added to resolved references, for HTML that no
   * renderer localizes afterwards (legacy static pages).
   */
  html(html: string | null | undefined, prefix?: string): Promise<string | null | undefined>;
  /** A usable slug of a referenced product (preload of picked sections), or null. */
  refSlug(id: string): Promise<string | null>;
}

interface ProductLinkData {
  slugIndex: ProductSlugIndex;
  idIndex: ProductIdIndex;
}

// One read per request, market and preview flag (layout + page share it).
// Failure = null: typed links render as typed, references fall back.
const productLinkData = cache(
  async (storeSlug: string, marketKey: string | null, preview: boolean): Promise<ProductLinkData | null> => {
    try {
      const ref: MarketRef = marketKey ? (preview ? { key: marketKey, preview: true } : { key: marketKey }) : undefined;
      const data = (await (ref ? storefront.getSitemapData(storeSlug, ref) : storefront.getSitemapData(storeSlug))) as {
        products?: SitemapProductEntry[];
      } | null;
      const products = data?.products ?? [];
      return { slugIndex: buildProductSlugIndex(products), idIndex: buildProductIdIndex(products) };
    } catch {
      return null;
    }
  },
);

// The redirect table of the request (pass 3), once per request.
const redirectLinkContext = cache(
  async (storeSlug: string, store: ProductLinkStore | null | undefined): Promise<RedirectLinkContext | null> => {
    const version = await getRequestRedirectsVersion();
    if (!version) return null;
    const map = await storeRedirectMap(storeSlug, version);
    if (!map || map.size === 0) return null;
    const market = store?.market ?? null;
    const pathMarketOf = (m: MarketRoute | null | undefined): PathMarket | null => (m && usesLocalePaths(m) ? m : null);
    const hosts = new Map<string, PathMarket | null>();
    const addHost = (host: string | null | undefined, m: MarketRoute | null | undefined) => {
      const h = host?.split(':')[0]?.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
      if (h && !hosts.has(h)) hosts.set(h, pathMarketOf(m));
    };
    try {
      const h = await headers();
      addHost(h.get('x-forwarded-host') ?? h.get('host'), market);
    } catch {
      // No request scope: relative links only.
    }
    if (store?.custom_domain) addHost(store.custom_domain, (store.markets ?? []).find((m) => m.is_default) ?? market);
    for (const m of store?.markets ?? []) addHost(marketPublicHostname(m, store?.custom_domain ?? null), m);
    return { map, pathMarket: pathMarketOf(market), hosts };
  },
);

function hasCandidate(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.includes('/products/');
  try {
    return JSON.stringify(value).includes('/products/');
  } catch {
    return false;
  }
}

/** A menu tree holds a PRODUCT item with a resource id, or a reference url. */
function menusNeedRefs(menus: NavMenu[]): boolean {
  return menus.some((m) =>
    (m.items ?? []).some((it) => (it.kind === 'PRODUCT' && !!it.resource_id) || hasProductRef(it.url)),
  );
}

/**
 * Rewriter of the product links of a page rendered in `locale` (see the
 * module comment for the two passes).
 */
export async function productLinkRewriter(
  storeSlug: string,
  store: ProductLinkStore | null | undefined,
  locale: string,
): Promise<ProductLinkRewriter> {
  const market = store?.market ?? null;
  const marketRef = await getRequestMarket();
  // Pass 2 (M164) only on a LIVE market request of a non-focused store.
  const typedOn =
    !!market &&
    !market.preview &&
    !!marketRef &&
    !marketRef.preview &&
    marketRef.key === market.key &&
    !(await requestFocusedStorefront(store?.checkout));

  let noindexP: Promise<boolean> | null = null;
  const noindex = () => (noindexP ??= getRequestNoindex());
  const primaryLocale = store?.language_config?.primary_locale || market?.default_locale || 'en';
  const secondaryLocales = store?.language_config?.secondary_locales || [];
  const refData = () => productLinkData(storeSlug, marketRef?.key ?? null, !!marketRef?.preview);

  const refContext = async (): Promise<ProductRefContext> => {
    const data = await refData();
    return {
      locale,
      primaryLocale,
      secondaryLocales,
      market,
      markets: store?.markets ?? [],
      storeCustomDomain: store?.custom_domain ?? null,
      noindex: market ? await noindex() : false,
      // No data: every reference falls back to the product list.
      idIndex: data?.idIndex ?? new Map(),
    };
  };

  const typedContext = async (value: unknown): Promise<ProductLinkContext | null> => {
    if (!typedOn || !market || !hasCandidate(value)) return null;
    const data = await productLinkData(storeSlug, market.key, false);
    if (!data || data.slugIndex.size === 0) return null;
    return {
      locale,
      primaryLocale,
      secondaryLocales,
      market,
      markets: store?.markets ?? [],
      storeCustomDomain: store?.custom_domain ?? null,
      noindex: await noindex(),
      index: data.slugIndex,
    };
  };

  const redirectCtx = () => redirectLinkContext(storeSlug, store);

  const refs = async <T extends SectionInstance[] | null | undefined>(sections: T): Promise<T> => {
    if (!sections || !hasProductRef(sections)) return sections;
    return resolveSectionProductRefs(sections, await refContext()) as T;
  };

  return {
    refs,
    async sections(sections) {
      const resolved = await refs(sections);
      const ctx = resolved ? await typedContext(resolved) : null;
      const typed = ctx && resolved ? (canonicalizeSectionLinks(resolved, ctx) as typeof sections) : resolved;
      const rctx = typed && typed.length ? await redirectCtx() : null;
      return rctx && typed ? (canonicalizeRedirectSections(typed, rctx) as typeof sections) : typed;
    },
    async menus(menus) {
      const resolved = menus && menusNeedRefs(menus) ? (resolveMenuProductRefs(menus, await refContext()) as typeof menus) : menus;
      const ctx = resolved ? await typedContext(resolved) : null;
      const typed = ctx && resolved ? (canonicalizeMenus(resolved, ctx) as typeof menus) : resolved;
      const rctx = typed && typed.length ? await redirectCtx() : null;
      return rctx && typed ? (canonicalizeRedirectMenus(typed, rctx) as typeof menus) : typed;
    },
    async html(html, prefix) {
      const localize = prefix ? (url: string) => localizeStoreUrl(url, prefix, locale) : undefined;
      const resolved = html && hasProductRef(html) ? resolveProductRefsInHtml(html, await refContext(), localize) : html;
      const ctx = resolved ? await typedContext(resolved) : null;
      const typed = ctx && resolved ? canonicalizeProductHtml(resolved, ctx) : resolved;
      const rctx = typed ? await redirectCtx() : null;
      return rctx && typed ? canonicalizeRedirectHtml(typed, rctx) : typed;
    },
    async refSlug(id) {
      const data = await refData();
      if (!data) return null;
      return productRefSlug(id, { idIndex: data.idIndex, primaryLocale, market, locale });
    },
  };
}
