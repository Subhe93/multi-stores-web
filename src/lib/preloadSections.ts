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
  return null;
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
  if (targets.length === 0) return {};

  const results = await Promise.allSettled(
    targets.map(async ({ params, limit }) => {
      const list = (await storefront.getProducts(storeSlug, params, opts.marketRef)) as unknown;
      return Array.isArray(list) ? list.slice(0, limit) : [];
    }),
  );

  const out: Record<string, unknown> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[targets[i].id] = r.value;
  });
  return out;
}
