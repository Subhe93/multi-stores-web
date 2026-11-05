import { cache } from 'react';
import { marketQuery, type MarketRef } from './market';
import { isStoreNotLiveError, storeHomeHref } from './storeGate';
import { previewFetchOptions, previewTokenFor, readBrowserPreviewCookie, resolveStorefrontFetchOptions } from './storePreview';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

// Resolve image URLs — relative /uploads/... paths come from the API server
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

/** Error thrown by `api()` for a non-2xx response. */
export type ApiError = Error & {
  status?: number;
  code?: string;
  why?: string;
  /** ICU params of the coded message (e.g. `{label, max}`). */
  params?: Record<string, unknown>;
  field_id?: string;
  field_name?: string;
  /** Cart row id (order create) or line index (quote) the error refers to. */
  line_id?: string;
  line_index?: number;
  /** Personalization app: `PERSONALIZATION_INVALID` carries the evaluator errors (M4.1 §4.3). */
  errors?: unknown[];
};

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

  // Content-Type only with a body: on a browser GET it would turn the
  // cross-origin request into a CORS preflight + GET.
  const hasBody = fetchOptions.body != null;
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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
    const err = new Error(json.message || 'API request failed') as ApiError;
    err.status = res.status;
    // Stable machine-readable error code (when present) for UI translation,
    // falling back to the English `message` above.
    err.code = typeof json.code === 'string' ? json.code : undefined;
    // Machine-readable reason next to some codes (b2b app M2.5:
    // B2B_REVERSE_CHARGE_NOT_CONFIRMED carries the decision's `why`).
    if (typeof json.why === 'string') err.why = json.why;
    // Personalization errors (M4.0 §4.2): ICU params and the field / cart
    // line they belong to. Only set when the API sent them.
    if (json.params && typeof json.params === 'object' && !Array.isArray(json.params)) err.params = json.params;
    if (typeof json.field_id === 'string') err.field_id = json.field_id;
    if (typeof json.field_name === 'string') err.field_name = json.field_name;
    if (typeof json.line_id === 'string') err.line_id = json.line_id;
    if (typeof json.line_index === 'number') err.line_index = json.line_index;
    if (Array.isArray(json.errors)) err.errors = json.errors;
    // Cart / checkout / order calls of a store that is not LIVE (409
    // STORE_NOT_LIVE): send the browser to the store home, which renders
    // the coming-soon page. The error is still thrown for the caller.
    if (typeof window !== 'undefined' && isStoreNotLiveError(err)) {
      window.location.assign(storeHomeHref(window.location.pathname));
    }
    throw err;
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
  // Browser fetch has no Next data cache, so tags / revalidate mean nothing
  // there; skip the cache-config round trip and use default fetch options.
  if (typeof window !== 'undefined') return {};

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

// ---------- Owner preview of a non-LIVE store (onboarding SPEC §3 / §7) ----------
//
// On the server the `ms_store_preview` cookie is read through a reader the
// store layout registers (`src/lib/storeGate.server.ts`), so this shared
// module never imports `next/headers`; in the browser `document.cookie` is
// read directly (the cookie is not HttpOnly). The token is attached only to
// the `storefront.*` reads of the slug it was accepted for, only while the
// public payload of that store is gated, and always with `cache: 'no-store'`.

type PreviewCookieReader = () => Promise<string | null>;
let serverPreviewCookieReader: PreviewCookieReader | null = null;

/** Server side: registers how the preview cookie of the current request is read. */
export function registerServerPreviewCookieReader(reader: PreviewCookieReader): void {
  serverPreviewCookieReader = reader;
}

async function readPreviewCookie(): Promise<string | null> {
  if (typeof window !== 'undefined') return readBrowserPreviewCookie();
  if (!serverPreviewCookieReader) return null;
  try {
    return await serverPreviewCookieReader();
  } catch {
    return null;
  }
}

/** Public (unauthenticated, normally cached) store payload, read once per request for the gate check. */
const publicStoreForGate = cache(async (slug: string): Promise<unknown> => {
  try {
    return await api(`/storefront/${slug}`, await cacheOpts(slug));
  } catch {
    return null;
  }
});

/**
 * Fetch options of a storefront read: the cached public options, or — for
 * a gated store whose preview cookie carries this slug's token — the
 * owner's Bearer token with no caching. Deduped per request on the server.
 */
const storefrontOpts = cache(async (slug: string): Promise<FetchOptions> => {
  const cookie = await readPreviewCookie();
  const fallback = await cacheOpts(slug);
  if (!cookie) return fallback;
  if (typeof window !== 'undefined') {
    // The browser cookie exists only while the store is gated (set by
    // StorePreviewUnlock, dropped by StorePreviewReset on a LIVE store), so
    // no extra gate read per call.
    const token = previewTokenFor(slug, cookie);
    return token ? previewFetchOptions(token) : fallback;
  }
  return resolveStorefrontFetchOptions({
    slug,
    store: (await publicStoreForGate(slug)) as { coming_soon?: boolean; paused?: boolean } | null,
    cookie,
    fallback,
  });
});

/** The owner preview token in force for this slug's storefront reads (null when not previewing). */
export async function getStorePreviewToken(slug: string): Promise<string | null> {
  const opts = await storefrontOpts(slug);
  return opts.token ?? null;
}

// Market → `?market=` suffix (markets app, M1-DESIGN §4.2), `marketQuery`
// of `src/lib/market.ts`. Appended to the URL so each market has its own
// cache entry (a preview adds `&preview=1`, its own entry again); the store
// tag is unchanged, so on-demand revalidation still covers every market of
// the store. Without a key the URL — and therefore the request — is
// byte-identical to before.

// Store legal page shapes (plans/store-legal-pages/SPEC.md, "API").
// MARKETPLACE stores always get `template` (filled with Namez AB as the seller).
export type StoreLegalSource = 'store_page' | 'template';

export interface StoreLegalPageSummary {
  slug: string;
  title: string;
  source: StoreLegalSource;
  /** Store page that serves this slug (`source: 'store_page'`), else null. */
  page_slug: string | null;
}

export type StoreLegalPage =
  // `locale` = the locale whose text was actually served (may fall back).
  | { source: 'template'; title: string; content: string; updated_at: null; locale?: string }
  | {
      source: 'store_page';
      title: string;
      page_slug: string;
      page_system: 'v2' | 'legacy';
      updated_at: string | null;
    };

// Storefront API helpers
export const storefront = {
  getStore: async (slug: string, market?: MarketRef) =>
    api(`/storefront/${slug}${marketQuery(market, false)}`, await storefrontOpts(slug)),

  getProducts: async (slug: string, params?: Record<string, string>, market?: MarketRef) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/storefront/${slug}/products${query}${marketQuery(market, Boolean(query))}`, await storefrontOpts(slug));
  },

  // Slug arguments are DECODED (pages run route params through `routeSlug`);
  // they are percent-encoded exactly once here.
  getProduct: async (slug: string, productSlug: string, locale?: string, market?: MarketRef) => {
    const query = locale ? `?locale=${locale}` : '';
    return api(`/storefront/${slug}/products/${encodeURIComponent(productSlug)}${query}${marketQuery(market, Boolean(query))}`, await storefrontOpts(slug));
  },

  getCategories: async (slug: string) =>
    api(`/storefront/${slug}/categories`, await storefrontOpts(slug)),

  getCreatorCategories: async (slug: string) =>
    api(`/storefront/${slug}/creator-categories`, await storefrontOpts(slug)),

  // Navigation menus (WordPress-style) — chrome sections resolve a menu key
  // to its items via the storeContext built from this.
  getMenus: async (slug: string) =>
    api(`/storefront/${slug}/menus`, await storefrontOpts(slug)),

  getPage: async (slug: string, pageSlug: string) =>
    api(`/storefront/${slug}/pages/${encodeURIComponent(pageSlug)}`, await storefrontOpts(slug)),

  // v2 published page snapshot (null if no published version).
  getPublishedHome: async (slug: string) =>
    api(`/storefront/${slug}/v2/home`, await storefrontOpts(slug)),

  getPublishedPage: async (slug: string, pageSlug: string, type?: 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE') => {
    const query = type ? `?type=${type}` : '';
    return api(`/storefront/${slug}/v2/pages/${encodeURIComponent(pageSlug)}${query}`, await storefrontOpts(slug));
  },

  // Single PRODUCT_TEMPLATE per store. Null when not published.
  getPublishedProductTemplate: async (slug: string) =>
    api(`/storefront/${slug}/v2/product-template`, await storefrontOpts(slug)),

  // Single CATALOG_TEMPLATE (serves /products) and COLLECTION_TEMPLATE (serves
  // every /collections/[handle]) per store. Null when not published — the
  // routes then fall back to their built-in listing markup.
  getPublishedCatalogTemplate: async (slug: string) =>
    api(`/storefront/${slug}/v2/catalog-template`, await storefrontOpts(slug)),

  getPublishedCollectionTemplate: async (slug: string) =>
    api(`/storefront/${slug}/v2/collection-template`, await storefrontOpts(slug)),

  // Store-wide chrome. Null when the creator hasn't published the HEADER /
  // FOOTER pages yet — StoreLayout falls back to its built-in components.
  getPublishedHeader: async (slug: string) =>
    api(`/storefront/${slug}/v2/header`, await storefrontOpts(slug)),

  getPublishedFooter: async (slug: string) =>
    api(`/storefront/${slug}/v2/footer`, await storefrontOpts(slug)),

  // A real published product to use as the preview's sample. Null when the
  // store has no published products yet.
  getSampleProduct: async (slug: string) =>
    api(`/storefront/${slug}/v2/sample-product`, await storefrontOpts(slug)),

  // Store legal pages (Privacy / Terms / Refund / Shipping) served at
  // `/legal/{slug}` on the store host: the store's own page, else a filled
  // default template (MARKETPLACE stores: always the template, with Namez AB
  // as the seller). Store tagged like every storefront read; the platform
  // LegalPage texts are never involved, so no platform `legal` tags.
  getLegalPages: async (slug: string, locale: string, market?: MarketRef) =>
    api<StoreLegalPageSummary[]>(
      `/storefront/${slug}/legal?locale=${encodeURIComponent(locale)}${marketQuery(market, true)}`,
      await storefrontOpts(slug),
    ),

  // `legalSlug` is DECODED; it is percent-encoded exactly once here.
  getLegalPage: async (slug: string, legalSlug: string, locale: string, market?: MarketRef) =>
    api<StoreLegalPage>(
      `/storefront/${slug}/legal/${encodeURIComponent(legalSlug)}?locale=${encodeURIComponent(locale)}${marketQuery(market, true)}`,
      await storefrontOpts(slug),
    ),

  // Aggregated URL list for the storefront's sitemap.xml route.
  getSitemapData: async (slug: string, market?: MarketRef) =>
    api(`/storefront/${slug}/sitemap-data${marketQuery(market, false)}`, await storefrontOpts(slug)),
};

// Platform-wide legal pages (Privacy / Terms / Refund / Shipping). Public,
// no auth, served localized by the API with sensible fallbacks. These are
// the *platform* policies, shared across the marketing site and every store
// footer, so they live outside the per-store cache namespace.
export interface LegalPageSummary {
  slug: string;
  title: string;
  updated_at: string;
}

export interface LegalPage extends LegalPageSummary {
  content: string;
}

const LEGAL_REVALIDATE_SECONDS = 3600;

export const legal = {
  list: async (locale: string) =>
    api<LegalPageSummary[]>(`/legal?locale=${encodeURIComponent(locale)}`, {
      next: { tags: ['legal'], revalidate: LEGAL_REVALIDATE_SECONDS },
    }),

  // `slug` is DECODED (the pages run the route param through `routeSlug`),
  // so it is percent-encoded exactly once here.
  get: async (slug: string, locale: string) =>
    api<LegalPage>(`/legal/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, {
      next: { tags: ['legal', `legal:${slug}`], revalidate: LEGAL_REVALIDATE_SECONDS },
    }),
};

// Canonical ordering used in footers — keep stable across locales so the
// link strip looks the same everywhere.
export const LEGAL_SLUGS = ['privacy', 'terms', 'refund', 'shipping'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
