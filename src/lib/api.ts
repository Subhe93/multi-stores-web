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
}

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

// Storefront API helpers
export const storefront = {
  getStore: (slug: string) =>
    api(`/storefront/${slug}`),

  getProducts: (slug: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/storefront/${slug}/products${query}`);
  },

  getProduct: (slug: string, productSlug: string, locale?: string) => {
    const query = locale ? `?locale=${locale}` : '';
    return api(`/storefront/${slug}/products/${productSlug}${query}`);
  },

  getCategories: (slug: string) =>
    api(`/storefront/${slug}/categories`),

  getCreatorCategories: (slug: string) =>
    api(`/storefront/${slug}/creator-categories`),

  // Navigation menus (WordPress-style) — chrome sections resolve a menu key
  // to its items via the storeContext built from this.
  getMenus: (slug: string) =>
    api(`/storefront/${slug}/menus`),

  getPage: (slug: string, pageSlug: string) =>
    api(`/storefront/${slug}/pages/${pageSlug}`),

  // v2 published page snapshot (null if no published version).
  getPublishedHome: (slug: string) =>
    api(`/storefront/${slug}/v2/home`),

  getPublishedPage: (slug: string, pageSlug: string, type?: 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE') => {
    const query = type ? `?type=${type}` : '';
    return api(`/storefront/${slug}/v2/pages/${pageSlug}${query}`);
  },

  // Single PRODUCT_TEMPLATE per store. Null when not published.
  getPublishedProductTemplate: (slug: string) =>
    api(`/storefront/${slug}/v2/product-template`),

  // Store-wide chrome. Null when the creator hasn't published the HEADER /
  // FOOTER pages yet — StoreLayout falls back to its built-in components.
  getPublishedHeader: (slug: string) =>
    api(`/storefront/${slug}/v2/header`),

  getPublishedFooter: (slug: string) =>
    api(`/storefront/${slug}/v2/footer`),

  // A real published product to use as the preview's sample. Null when the
  // store has no published products yet.
  getSampleProduct: (slug: string) =>
    api(`/storefront/${slug}/v2/sample-product`),

  // Aggregated URL list for the storefront's sitemap.xml route.
  getSitemapData: (slug: string) =>
    api(`/storefront/${slug}/sitemap-data`),
};
