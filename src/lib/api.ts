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

// Build cache options for a storefront read. Every read is tagged with the
// store so a single revalidateTag(storeTag(slug)) refreshes the whole store.
const cached = (slug: string): FetchOptions => ({
  next: { tags: [storeTag(slug)], revalidate: STOREFRONT_REVALIDATE_SECONDS },
});

// Storefront API helpers
export const storefront = {
  getStore: (slug: string) =>
    api(`/storefront/${slug}`, cached(slug)),

  getProducts: (slug: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/storefront/${slug}/products${query}`, cached(slug));
  },

  getProduct: (slug: string, productSlug: string, locale?: string) => {
    const query = locale ? `?locale=${locale}` : '';
    return api(`/storefront/${slug}/products/${productSlug}${query}`, cached(slug));
  },

  getCategories: (slug: string) =>
    api(`/storefront/${slug}/categories`, cached(slug)),

  getCreatorCategories: (slug: string) =>
    api(`/storefront/${slug}/creator-categories`, cached(slug)),

  // Navigation menus (WordPress-style) — chrome sections resolve a menu key
  // to its items via the storeContext built from this.
  getMenus: (slug: string) =>
    api(`/storefront/${slug}/menus`, cached(slug)),

  getPage: (slug: string, pageSlug: string) =>
    api(`/storefront/${slug}/pages/${pageSlug}`, cached(slug)),

  // v2 published page snapshot (null if no published version).
  getPublishedHome: (slug: string) =>
    api(`/storefront/${slug}/v2/home`, cached(slug)),

  getPublishedPage: (slug: string, pageSlug: string, type?: 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE') => {
    const query = type ? `?type=${type}` : '';
    return api(`/storefront/${slug}/v2/pages/${pageSlug}${query}`, cached(slug));
  },

  // Single PRODUCT_TEMPLATE per store. Null when not published.
  getPublishedProductTemplate: (slug: string) =>
    api(`/storefront/${slug}/v2/product-template`, cached(slug)),

  // Store-wide chrome. Null when the creator hasn't published the HEADER /
  // FOOTER pages yet — StoreLayout falls back to its built-in components.
  getPublishedHeader: (slug: string) =>
    api(`/storefront/${slug}/v2/header`, cached(slug)),

  getPublishedFooter: (slug: string) =>
    api(`/storefront/${slug}/v2/footer`, cached(slug)),

  // A real published product to use as the preview's sample. Null when the
  // store has no published products yet.
  getSampleProduct: (slug: string) =>
    api(`/storefront/${slug}/v2/sample-product`, cached(slug)),

  // Aggregated URL list for the storefront's sitemap.xml route.
  getSitemapData: (slug: string) =>
    api(`/storefront/${slug}/sitemap-data`, cached(slug)),
};
