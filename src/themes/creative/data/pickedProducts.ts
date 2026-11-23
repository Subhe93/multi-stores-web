// Live product data of the three selling brand sections (cover-hero,
// look-spread, object-study). The owner links a product with an ordinary url
// field holding `/products/<slug>`; the server preloads those products and
// each section receives `preloaded: PickedPreload`. Pure module: no fetch
// here (lib/preloadSections.ts and the demo route do the reading).
//
// `url` of a picked product is the canonical path of the rendered locale
// (`productLinkPath`, M163), not the slug the owner typed: a German page
// links the German slug even when the owner pasted the Swedish one.
//
// M165: a pick field can also hold a product reference (`product:<id>`,
// written by the dashboard product picker). Its preload key is the reference
// itself (`pickKeyFromUrl`), and the preload finds the product by id, so
// non-ASCII slugs work there too.

import { isStoreLinkRef, parseStoreLinkRef } from '@multi-stores/core/link-ref';
import { productLinkPath } from '@/lib/productPaths';

/** Rendered href of a product reference the server could not resolve. */
export const PRODUCT_REF_FALLBACK = '/products';

export type PickedProduct = {
  slug: string;
  title: string;
  url: string;
  image?: string;
  price?: number;
  compareAt?: number;
  currency?: string;
  available?: boolean;
};

export type PickedPreload = { products: Record<string, PickedProduct> };

export const PICKED_SECTION_KEYS = ['cover-hero', 'look-spread', 'object-study'] as const;
export const PICKED_MAX_SLUGS = 8;

type PickedSectionKey = (typeof PICKED_SECTION_KEYS)[number];

/**
 * The pick fields per section: a `settings` key, or the `items[]` key of the
 * look-spread rows (content first, then settings). Single source for the
 * preload keys and for the server link resolver, which leaves these fields
 * as references so the preload can key on them.
 */
export const PICKED_FIELDS: Record<PickedSectionKey, { settings?: string; itemsUrl?: string }> = {
  'cover-hero': { settings: 'detail_url' },
  'object-study': { settings: 'product_url' },
  'look-spread': { itemsUrl: 'url' },
};

export function isPickedSectionKey(key: unknown): key is PickedSectionKey {
  return typeof key === 'string' && (PICKED_SECTION_KEYS as readonly string[]).includes(key);
}

/** `/products/<slug>` with an optional locale prefix, query or hash; anything else is null. */
export function productSlugFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const path = url.trim().split(/[?#]/)[0];
  const m = /^\/(?:[a-z]{2}\/)?products\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?$/.exec(path);
  return m ? m[1] : null;
}

/**
 * Preload key of a pick value: the slug of a typed `/products/<slug>` url
 * (`productSlugFromUrl`), or `product:<id>` (lowercase id, tail dropped) for
 * a product reference; null otherwise.
 */
export function pickKeyFromUrl(url: unknown): string | null {
  const ref = parseStoreLinkRef(url);
  if (ref) return `product:${ref.id}`;
  return productSlugFromUrl(url);
}

/** Product id of a reference preload key, or null for a slug key. */
export function pickKeyProductId(key: string): string | null {
  return key.startsWith('product:') ? key.slice('product:'.length) : null;
}

/** Raw pick values of a section (its known url fields). */
export function pickedUrls(sectionKey: string, settings: unknown, content: unknown): unknown[] {
  if (!isPickedSectionKey(sectionKey)) return [];
  const fields = PICKED_FIELDS[sectionKey];
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const c = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
  const urls: unknown[] = [];
  if (fields.settings) urls.push(s[fields.settings]);
  if (fields.itemsUrl) {
    const items = Array.isArray(c.items) ? c.items : Array.isArray(s.items) ? s.items : [];
    for (const row of items) if (row && typeof row === 'object') urls.push((row as Record<string, unknown>)[fields.itemsUrl]);
  }
  return urls;
}

/** Preload keys (typed slugs and product references) a section links to, at most eight. */
export function pickedKeys(sectionKey: string, settings: unknown, content: unknown): string[] {
  const out: string[] = [];
  for (const url of pickedUrls(sectionKey, settings, content)) {
    const key = pickKeyFromUrl(url);
    if (key && !out.includes(key)) out.push(key);
    if (out.length >= PICKED_MAX_SLUGS) break;
  }
  return out;
}

/** Typed product slugs only (the pre-M165 reader). */
export function pickedSlugs(sectionKey: string, settings: unknown, content: unknown): string[] {
  return pickedKeys(sectionKey, settings, content).filter((k) => !pickKeyProductId(k));
}

/** The preloaded product a url (typed or reference) points to, or null. */
export function picked(preloaded: unknown, url: unknown): PickedProduct | null {
  const slug = pickKeyFromUrl(url);
  if (!slug || !preloaded || typeof preloaded !== 'object') return null;
  const products = (preloaded as { products?: unknown }).products;
  if (!products || typeof products !== 'object') return null;
  const hit = (products as Record<string, unknown>)[slug];
  if (!hit || typeof hit !== 'object') return null;
  return typeof (hit as PickedProduct).title === 'string' ? (hit as PickedProduct) : null;
}

/** The fields read from a storefront product (list row or product detail). */
export interface PickedSourceRow {
  base_price?: number | string | null;
  compare_at_price?: number | string | null;
  track_inventory?: boolean | null;
  stock_quantity?: number | string | null;
  translations?: Array<{ locale?: string; title?: string | null; slug?: string | null }> | null;
  images?: Array<{ url?: string | null; sort_order?: number | null }> | null;
  variants?: Array<{ is_active?: boolean | null; stock?: number | string | null; stock_quantity?: number | string | null }> | null;
}

function finite(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Whether the row carries a translation with this slug (slugs differ per locale). */
export function rowHasSlug(row: PickedSourceRow, slug: string): boolean {
  return Array.isArray(row.translations) && row.translations.some((t) => t?.slug === slug);
}

/**
 * A storefront product as the sections read it; null without a title.
 * `slug` is the owner's slug (the preload key). `fallbackLocale` is the
 * locale the title and the link slug fall back to: the market default, else
 * the store primary locale (`productLinkFallbackLocale`).
 */
export function toPickedProduct(
  row: PickedSourceRow,
  slug: string,
  locale: string,
  fallbackLocale: string,
  currency?: string,
): PickedProduct | null {
  const trs = Array.isArray(row.translations) ? row.translations : [];
  const tr = trs.find((t) => t?.locale === locale) || trs.find((t) => t?.locale === fallbackLocale) || trs[0];
  const title = typeof tr?.title === 'string' ? tr.title.trim() : '';
  if (!title) return null;
  const images = Array.isArray(row.images) ? [...row.images] : [];
  images.sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0));
  const image = typeof images[0]?.url === 'string' ? images[0].url : undefined;
  const compareAt = finite(row.compare_at_price);
  // Sold out only when inventory is tracked and nothing is left anywhere.
  let available: boolean | undefined;
  if (row.track_inventory) {
    const variants = (Array.isArray(row.variants) ? row.variants : []).filter((v) => v && v.is_active !== false);
    const left = variants.length
      ? variants.reduce((sum, v) => sum + (finite(v.stock ?? v.stock_quantity) ?? 0), 0)
      : (finite(row.stock_quantity) ?? 0);
    available = left > 0;
  }
  return {
    slug,
    title,
    // Without any usable translation slug this stays `/products/<owner slug>`.
    url: productLinkPath(trs, { locale, fallbackLocale, id: slug }),
    ...(image ? { image } : null),
    ...(finite(row.base_price) !== undefined ? { price: finite(row.base_price) } : null),
    ...(compareAt ? { compareAt } : null),
    ...(currency ? { currency } : null),
    ...(available !== undefined ? { available } : null),
  };
}

/**
 * Href source of an owner link to a picked product: the live canonical path
 * (`live.url`) plus the owner's `?query` / `#hash`, else the owner URL as
 * typed (the product was not preloaded). An owner-typed locale prefix is
 * dropped on purpose: the caller's `sectionHref` adds the current one.
 * A reference that was not preloaded (deleted, unpublished, hidden in the
 * market) links to the product list, never to a raw `product:` href.
 */
export function pickedHref(ownerUrl: string, live: { url?: unknown } | null | undefined): string {
  const path = live && typeof live.url === 'string' ? live.url : '';
  if (!path.startsWith('/products/')) return isStoreLinkRef(ownerUrl) ? PRODUCT_REF_FALLBACK : ownerUrl;
  const tail = /[?#].*$/.exec(ownerUrl.trim());
  return tail ? `${path}${tail[0]}` : path;
}
