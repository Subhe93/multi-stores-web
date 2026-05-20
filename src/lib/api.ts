import { cache } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

// Resolve image URLs — relative /uploads/... paths come from the API server
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

interface FetchOptions extends RequestInit {
  token?: string;
  next?: { revalidate?: number | false; tags?: string[] };
}

// Cache tag for everything belonging to a single store. Publishing or editing
// any store resource in the dashboard triggers revalidateTag(storeTag(slug)),
// so the storefront serves cached data yet reflects changes within seconds.
export const storeTag = (slug: string) => `store:${slug}`;

// Storefront data is cached for an hour as a fallback; on-demand revalidation
// (via /api/revalidate) is the primary freshness mechanism.
const STOREFRONT_REVALIDATE_SECONDS = 3600;

export async function api<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || 'API request failed');
  }

  return json.data;
}

// Resolve cache options for a storefront read. Caching is production-only; in
// development we never cache so edits show instantly. In production each store
// carries a `cache_enabled` flag — when off, that store is served always-fresh.
// The flag fetch is store-tagged (toggling it triggers revalidation) and
// deduped per render via React cache(), so it adds no meaningful overhead.
const cacheOpts = cache(async (slug: string): Promise<FetchOptions> => {
  if (process.env.NODE_ENV !== 'production') return { cache: 'no-store' };

  let enabled = true;
  try {
    const cfg = await api<{ enabled: boolean }>(`/storefront/${slug}/cache-config`, {
      next: { tags: [storeTag(slug)], revalidate: 30 },
    });
    enabled = cfg.enabled;
  } catch {
    enabled = true; // fail open to cached behaviour on a flag-fetch hiccup
  }

  return enabled
    ? { next: { tags: [storeTag(slug)], revalidate: STOREFRONT_REVALIDATE_SECONDS } }
    : { cache: 'no-store' };
});

// Storefront API helpers
export const storefront = {
  getStore: async (slug: string) =>
    api(`/storefront/${slug}`, await cacheOpts(slug)),

  getProducts: async (slug: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/storefront/${slug}/products${query}`, await cacheOpts(slug));
  },

  getProduct: async (slug: string, productSlug: string, locale?: string) => {
    const query = locale ? `?locale=${locale}` : '';
    return api(`/storefront/${slug}/products/${productSlug}${query}`, await cacheOpts(slug));
  },

  getCategories: async (slug: string) =>
    api(`/storefront/${slug}/categories`, await cacheOpts(slug)),

  getCreatorCategories: async (slug: string) =>
    api(`/storefront/${slug}/creator-categories`, await cacheOpts(slug)),

  // Navigation menus (WordPress-style) — chrome sections resolve a menu key
  // to its items via the storeContext built from this.
  getMenus: async (slug: string) =>
    api(`/storefront/${slug}/menus`, await cacheOpts(slug)),

  getPage: async (slug: string, pageSlug: string) =>
    api(`/storefront/${slug}/pages/${pageSlug}`, await cacheOpts(slug)),

  // v2 published page snapshot (null if no published version).
  getPublishedHome: async (slug: string) =>
    api(`/storefront/${slug}/v2/home`, await cacheOpts(slug)),

  getPublishedPage: async (slug: string, pageSlug: string, type?: 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE') => {
    const query = type ? `?type=${type}` : '';
    return api(`/storefront/${slug}/v2/pages/${pageSlug}${query}`, await cacheOpts(slug));
  },

  // Single PRODUCT_TEMPLATE per store. Null when not published.
  getPublishedProductTemplate: async (slug: string) =>
    api(`/storefront/${slug}/v2/product-template`, await cacheOpts(slug)),

  // Store-wide chrome. Null when the creator hasn't published the HEADER /
  // FOOTER pages yet — StoreLayout falls back to its built-in components.
  getPublishedHeader: async (slug: string) =>
    api(`/storefront/${slug}/v2/header`, await cacheOpts(slug)),

  getPublishedFooter: async (slug: string) =>
    api(`/storefront/${slug}/v2/footer`, await cacheOpts(slug)),

  // A real published product to use as the preview's sample. Null when the
  // store has no published products yet.
  getSampleProduct: async (slug: string) =>
    api(`/storefront/${slug}/v2/sample-product`, await cacheOpts(slug)),

  // Aggregated URL list for the storefront's sitemap.xml route.
  getSitemapData: async (slug: string) =>
    api(`/storefront/${slug}/sitemap-data`, await cacheOpts(slug)),
};
