// Product link references -> canonical product URL (M165).
//
// The dashboard product picker stores `product:<id>` (grammar:
// `@multi-stores/core/link-ref`) in link fields instead of a typed slug. This
// module turns such a reference into `/products/<slug><tail>` for the locale
// and market of the rendered page, choosing the same slug the product page
// would redirect to (`productCanonicalSlug`, M164), so a click never causes a
// redirect hop. The result is raw and relative, like `productLinkPath`: the
// renderer's `localizeStoreUrl` adds the request prefix afterwards.
//
// An unknown, deleted, unpublished or market-hidden product resolves to null;
// the section / HTML walkers then use PRODUCT_REF_FALLBACK (the product list)
// so a reference never reaches the browser unresolved. Pure: no `next/*`.

import { formatProductRef, isStoreLinkRef, parseStoreLinkRef, PRODUCT_REF_MARKER } from '@multi-stores/core/link-ref';
import type { MarketRoute } from './market';
import type { NavMenu, SectionInstance } from '@/themes/types';
import { productCanonicalSlug, productLinkFallbackLocale, productLinkSlug } from './productPaths';
import type { ProductIdIndex } from './productLinkCanonical';
import { isPickedSectionKey, PICKED_FIELDS, PRODUCT_REF_FALLBACK } from '@/themes/creative/data/pickedProducts';

export { PRODUCT_REF_FALLBACK };

export interface ProductRefContext {
  /** Locale of the rendered page. */
  locale: string;
  /** Store primary locale (store payload `language_config`). */
  primaryLocale: string;
  secondaryLocales: string[];
  /** Market of the request (null = no markets app). */
  market?: MarketRoute | null;
  markets: MarketRoute[];
  storeCustomDomain?: string | null;
  /** The proxy's noindex verdict (same input as the product redirect). */
  noindex?: boolean;
  idIndex: ProductIdIndex;
}

/** Cheap check: may this value (string or JSON-able object) hold a reference? */
export function hasProductRef(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.toLowerCase().includes(PRODUCT_REF_MARKER);
  try {
    return JSON.stringify(value).toLowerCase().includes(PRODUCT_REF_MARKER);
  } catch {
    return false;
  }
}

/** Any usable slug of a referenced product (fallback-locale first), or null. */
export function productRefSlug(id: string, ctx: Pick<ProductRefContext, 'idIndex' | 'primaryLocale' | 'market' | 'locale'>): string | null {
  const translations = ctx.idIndex.get(id.toLowerCase());
  if (!translations) return null;
  const fallbackLocale = productLinkFallbackLocale(ctx.primaryLocale, ctx.market ?? null);
  return productLinkSlug(translations, ctx.locale, fallbackLocale);
}

/**
 * `/products/<slug><tail>` of a product reference for the page locale, or
 * null (not a product reference, unknown id, no usable slug).
 */
export function resolveProductRef(value: string, ctx: ProductRefContext): string | null {
  const ref = parseStoreLinkRef(value);
  if (!ref) return null;
  const translations = ctx.idIndex.get(ref.id);
  if (!translations) return null;
  const fallbackLocale = productLinkFallbackLocale(ctx.primaryLocale, ctx.market ?? null);
  const linkSlug = productLinkSlug(translations, ctx.locale, fallbackLocale);
  if (!linkSlug) return null;
  const slug = ctx.market
    ? productCanonicalSlug({
        store: {
          custom_domain: ctx.storeCustomDomain ?? null,
          language_config: { primary_locale: ctx.primaryLocale, secondary_locales: ctx.secondaryLocales },
          market: ctx.market,
          markets: ctx.markets,
        },
        translations,
        matchedSlug: linkSlug,
        locale: ctx.locale,
        noindex: ctx.noindex,
      })
    : linkSlug;
  return `/products/${slug}${ref.tail}`;
}

/** A whole-string link value: resolved reference, the fallback, or unchanged. */
function resolveLinkValue(value: string, ctx: ProductRefContext): string {
  if (!isStoreLinkRef(value)) return value;
  return resolveProductRef(value, ctx) ?? PRODUCT_REF_FALLBACK;
}

/**
 * Every `href="…"` / `href='…'` reference of owner HTML resolved (fallback
 * for unknown ones). `localize` adds the request prefix to a resolved
 * reference, for HTML that no renderer localizes afterwards (legacy static
 * pages); section HTML leaves it out (`sectionHtml` adds the prefix later).
 */
export function resolveProductRefsInHtml(html: string, ctx: ProductRefContext, localize?: (url: string) => string): string {
  if (typeof html !== 'string' || !hasProductRef(html)) return html;
  return html.replace(/(\shref\s*=\s*)(["'])([^"']*)\2/gi, (whole, attr: string, quote: string, value: string) => {
    const next = resolveLinkValue(value, ctx);
    if (next === value) return whole;
    return `${attr}${quote}${localize ? localize(next) : next}${quote}`;
  });
}

function resolveString(value: string, ctx: ProductRefContext): string {
  if (!hasProductRef(value)) return value;
  if (/\shref\s*=/i.test(value)) return resolveProductRefsInHtml(value, ctx);
  return resolveLinkValue(value, ctx);
}

type SkipPath = (path: readonly (string | number)[]) => boolean;

/** Copy-on-write deep walk: unchanged branches keep their identity. */
function walk(value: unknown, ctx: ProductRefContext, path: (string | number)[], skip: SkipPath | null): unknown {
  if (typeof value === 'string') return skip?.(path) ? value : resolveString(value, ctx);
  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    value.forEach((item, i) => {
      const next = walk(item, ctx, [...path, i], skip);
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
      const next = walk(item, ctx, [...path, key], skip);
      if (next !== item) {
        out ??= { ...(value as Record<string, unknown>) };
        out[key] = next;
      }
    }
    return out ?? value;
  }
  return value;
}

/**
 * Pick fields of the creative picked-product sections keep their reference:
 * the server preload keys on it (`pickKeyFromUrl`), and the section renders
 * the live canonical path or the fallback (`pickedHref`).
 */
function pickSkip(sectionKey: unknown): SkipPath | null {
  if (!isPickedSectionKey(sectionKey)) return null;
  const fields = PICKED_FIELDS[sectionKey];
  return (p) => {
    if (fields.settings && p.length === 2 && p[0] === 'settings' && p[1] === fields.settings) return true;
    if (fields.itemsUrl) {
      // settings.items[i].url, translations[i].content.items[j].url
      if (p.length === 4 && p[0] === 'settings' && p[1] === 'items' && p[3] === fields.itemsUrl) return true;
      if (p.length === 6 && p[0] === 'translations' && p[2] === 'content' && p[3] === 'items' && p[5] === fields.itemsUrl) return true;
    }
    return false;
  };
}

/** References of every section's settings and content rows (all themes). */
export function resolveSectionProductRefs(sections: SectionInstance[], ctx: ProductRefContext): SectionInstance[] {
  let out: SectionInstance[] | null = null;
  sections.forEach((section, i) => {
    const next = walk(section, ctx, [], pickSkip(section?.section_key)) as SectionInstance;
    if (next !== section) {
      out ??= sections.slice();
      out[i] = next;
    }
  });
  return out ?? sections;
}

/**
 * Menus: a PRODUCT item whose `resource_id` is known gets the per-locale
 * link; an unknown one keeps its stored url (today's behaviour, M164 may
 * still rewrite it). A url that is itself a reference (CUSTOM item) resolves
 * like a section value, with the product-list fallback.
 */
export function resolveMenuProductRefs(menus: NavMenu[], ctx: ProductRefContext): NavMenu[] {
  let changed = false;
  const out = menus.map((menu) => {
    let itemsChanged = false;
    const items = (menu.items ?? []).map((item) => {
      let url = item.url;
      if (typeof url === 'string' && isStoreLinkRef(url)) {
        url = resolveLinkValue(url, ctx);
      } else if (item.kind === 'PRODUCT' && typeof item.resource_id === 'string' && item.resource_id) {
        url = resolveProductRef(formatProductRef(item.resource_id), ctx) ?? item.url;
      }
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

/** Safety net without data: every reference in sections becomes the fallback. */
export const NO_PRODUCT_DATA: ProductIdIndex = new Map();
