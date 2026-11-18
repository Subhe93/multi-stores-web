// Live product data of the three selling brand sections (cover-hero,
// look-spread, object-study). The owner links a product with an ordinary url
// field holding `/products/<slug>`; the server preloads those products and
// each section receives `preloaded: PickedPreload`. Pure module: no fetch
// here (lib/preloadSections.ts and the demo route do the reading).

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

/** `/products/<slug>` with an optional locale prefix, query or hash; anything else is null. */
export function productSlugFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const path = url.trim().split(/[?#]/)[0];
  const m = /^\/(?:[a-z]{2}\/)?products\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?$/.exec(path);
  return m ? m[1] : null;
}

/** Product slugs a section links to (its known url fields), at most eight. */
export function pickedSlugs(sectionKey: string, settings: unknown, content: unknown): string[] {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const c = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
  const urls: unknown[] = [];
  if (sectionKey === 'cover-hero') urls.push(s.detail_url);
  else if (sectionKey === 'object-study') urls.push(s.product_url);
  else if (sectionKey === 'look-spread') {
    const items = Array.isArray(c.items) ? c.items : Array.isArray(s.items) ? s.items : [];
    for (const row of items) if (row && typeof row === 'object') urls.push((row as Record<string, unknown>).url);
  }
  const out: string[] = [];
  for (const url of urls) {
    const slug = productSlugFromUrl(url);
    if (slug && !out.includes(slug)) out.push(slug);
    if (out.length >= PICKED_MAX_SLUGS) break;
  }
  return out;
}

/** The preloaded product a url points to, or null. */
export function picked(preloaded: unknown, url: unknown): PickedProduct | null {
  const slug = productSlugFromUrl(url);
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

/** A storefront product as the sections read it; null without a title. */
export function toPickedProduct(
  row: PickedSourceRow,
  slug: string,
  locale: string,
  primaryLocale: string,
  currency?: string,
): PickedProduct | null {
  const trs = Array.isArray(row.translations) ? row.translations : [];
  const tr = trs.find((t) => t?.locale === locale) || trs.find((t) => t?.locale === primaryLocale) || trs[0];
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
    url: `/products/${slug}`,
    ...(image ? { image } : null),
    ...(finite(row.base_price) !== undefined ? { price: finite(row.base_price) } : null),
    ...(compareAt ? { compareAt } : null),
    ...(currency ? { currency } : null),
    ...(available !== undefined ? { available } : null),
  };
}
