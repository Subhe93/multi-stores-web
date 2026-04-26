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

  getPage: (slug: string, pageSlug: string) =>
    api(`/storefront/${slug}/pages/${pageSlug}`),
};
