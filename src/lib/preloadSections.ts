// Server-side preloading of section data (M6.4).
//
// Some builder sections fetch their data client-side on mount (so the builder
// preview iframe works without a token). On the storefront that leaves the
// data out of the server HTML, invisible to crawlers. Routes that render page
// sections call `preloadSectionData` first and hand the result to
// `SectionRenderer`, which forwards each section its own entry as `preloaded`.
// A section that receives it renders from it on the server and skips its
// mount fetch; a missing entry (failed request, builder preview) leaves the
// client behaviour unchanged.
//
// The request params are built here, by the same function the client
// component uses, so the preloaded list is exactly what the client would
// have fetched.

import { storefront } from './api';
import type { MarketRef } from './market';
import type { SectionInstance } from '@/themes/types';
import {
  PICKED_SECTION_KEYS,
  pickedSlugs,
  toPickedProduct,
  type PickedPreload,
  type PickedProduct,
  type PickedSourceRow,
} from '@/themes/creative/data/pickedProducts';

export const COLLECTION_PRODUCTS_SECTION_KEY = 'collection-products';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Product limit of a collection-products section, clamped like the schema. */
export function collectionProductsLimit(settings: Record<string, unknown>): number {
  const raw = Number(settings.limit ?? 8);
  return clamp(Number.isFinite(raw) ? raw : 8, 1, 24);
}

/**
 * Query params of `GET /storefront/:slug/products` for a collection-products
 * section. `category` is a collection id (uuid, maps to `creator_category_id`
 * and accepts INTERNAL labels) or a legacy slug (maps to `creator_category`).
 */
export function collectionProductsParams(input: {
  locale: string;
  limit: number;
  category: string;
}): Record<string, string> {
  const params: Record<string, string> = { locale: input.locale, limit: String(input.limit) };
  if (input.category) {
    if (UUID_RE.test(input.category)) params.creator_category_id = input.category;
    else params.creator_category = input.category;
  }
  return params;
}

export const FEATURED_PRODUCTS_SECTION_KEY = 'featured-products';

/** Product limit of a featured-products section, clamped like the schema. */
export function featuredProductsLimit(settings: Record<string, unknown>): number {
  const raw = Number(settings.limit ?? 4);
  return clamp(Number.isFinite(raw) ? raw : 4, 1, 12);
}

/** Query params of `GET /storefront/:slug/products` for a featured-products section. */
export function featuredProductsParams(input: {
  locale: string;
  limit: number;
  filter: string;
}): Record<string, string> {
  const params: Record<string, string> = { locale: input.locale, limit: String(input.limit) };
  if (input.filter === 'featured') params.featured = 'true';
  return params;
}

export const PRODUCT_SLIDER_SECTION_KEY = 'product-slider';

/** Product limit of a product-slider section, clamped like the schema. */
export function productSliderLimit(settings: Record<string, unknown>): number {
  const raw = Number(settings.limit ?? 8);
  return clamp(Number.isFinite(raw) ? raw : 8, 1, 24);
}

/** Query params of `GET /storefront/:slug/products` for a product-slider section (same as featured-products). */
export function productSliderParams(input: {
  locale: string;
  limit: number;
  filter: string;
}): Record<string, string> {
  return featuredProductsParams(input);
}

/** The products request a section makes on mount, or null if it fetches nothing. */
function sectionProductsRequest(s: SectionInstance, locale: string): { params: Record<string, string>; limit: number } | null {
  const settings = s.settings || {};
  if (s.section_key === COLLECTION_PRODUCTS_SECTION_KEY) {
    // An empty category lists all products (same request as the client).
    const limit = collectionProductsLimit(settings);
    return { limit, params: collectionProductsParams({ locale, limit, category: (settings.category as string) || '' }) };
  }
  if (s.section_key === FEATURED_PRODUCTS_SECTION_KEY) {
    const limit = featuredProductsLimit(settings);
    return { limit, params: featuredProductsParams({ locale, limit, filter: (settings.filter as string) || 'newest' }) };
  }
  if (s.section_key === PRODUCT_SLIDER_SECTION_KEY) {
    const limit = productSliderLimit(settings);
    return { limit, params: productSliderParams({ locale, limit, filter: (settings.filter as string) || 'newest' }) };
  }
  return null;
}

/** Product slugs a brand section (cover-hero, look-spread, object-study) links to, over all its locales. */
function sectionPickedSlugs(s: SectionInstance): string[] {
  if (!(PICKED_SECTION_KEYS as readonly string[]).includes(s.section_key)) return [];
  const out = pickedSlugs(s.section_key, s.settings || {}, {});
  for (const tr of s.translations || []) {
    for (const slug of pickedSlugs(s.section_key, s.settings || {}, tr.content || {})) {
      if (!out.includes(slug)) out.push(slug);
    }
  }
  return out.slice(0, 8);
}

/**
 * Live products of the brand sections: one request per distinct slug, in
 * parallel, failures dropped. Returns `{ [section.id]: PickedPreload }`.
 */
async function preloadPickedProducts(
  storeSlug: string,
  sections: SectionInstance[],
  opts: { locale: string; marketRef?: MarketRef },
): Promise<Record<string, PickedPreload>> {
  const wanted = sections.flatMap((s) => {
    if (s.is_hidden) return [];
    const slugs = sectionPickedSlugs(s);
    return slugs.length ? [{ id: s.id, slugs }] : [];
  });
  if (wanted.length === 0) return {};
  const all = [...new Set(wanted.flatMap((w) => w.slugs))];
  const rows = await Promise.allSettled(
    all.map((slug) => storefront.getProduct(storeSlug, slug, opts.locale, opts.marketRef) as Promise<unknown>),
  );
  const bySlug: Record<string, PickedProduct> = {};
  rows.forEach((r, i) => {
    if (r.status !== 'fulfilled' || !r.value || typeof r.value !== 'object') return;
    const row = r.value as PickedSourceRow & { currency?: unknown };
    const product = toPickedProduct(row, all[i], opts.locale, opts.locale, typeof row.currency === 'string' ? row.currency : undefined);
    if (product) bySlug[all[i]] = product;
  });
  const out: Record<string, PickedPreload> = {};
  for (const w of wanted) {
    const products: Record<string, PickedProduct> = {};
    for (const slug of w.slugs) if (bySlug[slug]) products[slug] = bySlug[slug];
    if (Object.keys(products).length) out[w.id] = { products };
  }
  return out;
}

/**
 * Fetch, on the server, the data of every visible section that supports
 * preloading. Returns `{ [section.id]: data }`; sections whose request failed
 * are omitted so they fall back to client fetching.
 */
export async function preloadSectionData(
  storeSlug: string,
  sections: SectionInstance[],
  opts: { locale: string; marketRef?: MarketRef },
): Promise<Record<string, unknown>> {
  const targets = sections.flatMap((s) => {
    if (s.is_hidden) return [];
    const req = sectionProductsRequest(s, opts.locale);
    return req ? [{ id: s.id, ...req }] : [];
  });
  const pickedData = await preloadPickedProducts(storeSlug, sections, opts);
  if (targets.length === 0) return pickedData;

  const results = await Promise.allSettled(
    targets.map(async ({ params, limit }) => {
      const list = (await storefront.getProducts(storeSlug, params, opts.marketRef)) as unknown;
      return Array.isArray(list) ? list.slice(0, limit) : [];
    }),
  );

  const out: Record<string, unknown> = { ...pickedData };
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[targets[i].id] = r.value;
  });
  return out;
}
