import 'server-only';
import { cache } from 'react';
import { storefront } from './api';
import { requestFocusedStorefront } from './focusedStorefront.server';
import type { MarketRoute } from './market';
import { getRequestMarket, getRequestNoindex } from './market.server';
import {
  buildProductSlugIndex,
  canonicalizeMenus,
  canonicalizeProductHtml,
  canonicalizeSectionLinks,
  type ProductLinkContext,
  type ProductSlugIndex,
  type SitemapProductEntry,
} from './productLinkCanonical';
import type { NavMenu, SectionInstance } from '@/themes/types';

// Server wiring of M164 part 2: owner-typed product links are rewritten to
// the canonical URL before any section, menu or HTML reaches a client
// component (no hydration mismatch, no slug map in the browser).
//
// Market stores only. Every other store, a market preview and a focused
// storefront get the identity and make no extra read. The slug data is the
// sitemap-data read (store tag, same cache entry as sitemap.xml), fetched
// only when the content holds `/products/`, once per request.

/** The slice of the storefront store payload the rewrite needs. */
export interface ProductLinkStore {
  custom_domain?: string | null;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  market?: MarketRoute | null;
  markets?: MarketRoute[];
  checkout?: unknown;
}

export interface ProductLinkRewriter {
  sections<T extends SectionInstance[] | null | undefined>(sections: T): Promise<T>;
  menus<T extends NavMenu[] | null | undefined>(menus: T): Promise<T>;
  html(html: string | null | undefined): Promise<string | null | undefined>;
}

const IDENTITY: ProductLinkRewriter = {
  sections: async (s) => s,
  menus: async (m) => m,
  html: async (h) => h,
};

// One read per request and market (layout + page share it). Failure = null
// (links render as typed).
const productSlugIndex = cache(async (storeSlug: string, marketKey: string): Promise<ProductSlugIndex | null> => {
  try {
    const data = (await storefront.getSitemapData(storeSlug, { key: marketKey })) as {
      products?: SitemapProductEntry[];
    } | null;
    return buildProductSlugIndex(data?.products ?? []);
  } catch {
    return null;
  }
});

function hasCandidate(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.includes('/products/');
  try {
    return JSON.stringify(value).includes('/products/');
  } catch {
    return false;
  }
}

/**
 * Rewriter of owner-typed product links for a page rendered in `locale`.
 * Identity (no read) unless the request is a LIVE market of a store that is
 * not a focused storefront.
 */
export async function productLinkRewriter(
  storeSlug: string,
  store: ProductLinkStore | null | undefined,
  locale: string,
): Promise<ProductLinkRewriter> {
  const market = store?.market;
  if (!market || market.preview) return IDENTITY;
  const marketRef = await getRequestMarket();
  if (!marketRef || marketRef.preview || marketRef.key !== market.key) return IDENTITY;
  if (await requestFocusedStorefront(store?.checkout)) return IDENTITY;
  const noindex = await getRequestNoindex();

  const context = async (value: unknown): Promise<ProductLinkContext | null> => {
    if (!hasCandidate(value)) return null;
    const index = await productSlugIndex(storeSlug, market.key);
    if (!index || index.size === 0) return null;
    return {
      locale,
      primaryLocale: store?.language_config?.primary_locale || market.default_locale || 'en',
      secondaryLocales: store?.language_config?.secondary_locales || [],
      market,
      markets: store?.markets ?? [],
      storeCustomDomain: store?.custom_domain ?? null,
      noindex,
      index,
    };
  };

  return {
    async sections(sections) {
      const ctx = sections ? await context(sections) : null;
      return ctx && sections ? (canonicalizeSectionLinks(sections, ctx) as typeof sections) : sections;
    },
    async menus(menus) {
      const ctx = menus ? await context(menus) : null;
      return ctx && menus ? (canonicalizeMenus(menus, ctx) as typeof menus) : menus;
    },
    async html(html) {
      const ctx = html ? await context(html) : null;
      return ctx && html ? canonicalizeProductHtml(html, ctx) : html;
    },
  };
}
