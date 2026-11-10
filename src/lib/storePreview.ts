// Owner preview of a store that is not LIVE (onboarding SPEC §3 / §7).
//
// The API serves the full data of every public storefront read endpoint
// (`GET /storefront/:slug/*`) when the request carries the owner's (or an
// admin's) Bearer JWT, and the closed shape otherwise. The browser keeps
// that token in the `ms_store_preview` cookie (set by `StorePreviewUnlock`
// once the API accepted it), bound to the store slug it was accepted for,
// and `src/lib/api.ts` attaches it to the storefront reads of that slug —
// with `cache: 'no-store'`, so no preview answer ever lands in the Next
// data cache or under a store cache tag.
//
// Pure helpers only (shared by server and browser); no `next/headers`.

import { isPlausibleToken } from '@/components/edit-hint/editHintStorage';
import { PRODUCT_PREVIEW_COOKIE, STORE_PREVIEW_COOKIE, storeGate, type StoreGateFields } from './storeGate';

/** Cookie value: `<slug>:<jwt>` (a slug never contains ':'; a JWT neither). */
export function encodePreviewCookie(slug: string, token: string): string {
  return encodeURIComponent(`${slug}:${token}`);
}

/** The token of a cookie value when it was issued for `slug`; null otherwise. */
export function previewTokenFor(slug: string, raw: string | null | undefined): string | null {
  if (!raw || !slug) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const sep = value.indexOf(':');
  if (sep <= 0) return null;
  if (value.slice(0, sep) !== slug) return null;
  const token = value.slice(sep + 1);
  return isPlausibleToken(token) ? token : null;
}

/** Fetch options of a preview read: Bearer token, never cached. */
export function previewFetchOptions(token: string): { token: string; cache: 'no-store' } {
  return { token, cache: 'no-store' };
}

/**
 * Picks the fetch options of a storefront read: the preview options when
 * the store is gated (`coming_soon` / `paused`) and the cookie carries a
 * token for this slug, otherwise the caller's normal (cached) options.
 * A LIVE store never gets the header, whatever the cookie says.
 */
export function resolveStorefrontFetchOptions<T>(args: {
  slug: string;
  store: StoreGateFields | null | undefined;
  cookie: string | null | undefined;
  fallback: T;
}): T | { token: string; cache: 'no-store' } {
  if (storeGate(args.store) === 'live') return args.fallback;
  const token = previewTokenFor(args.slug, args.cookie);
  return token ? previewFetchOptions(token) : args.fallback;
}

/** Raw value of a preview cookie in the browser (null elsewhere / when absent). */
export function readBrowserPreviewCookie(cookieName: string = STORE_PREVIEW_COOKIE): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) return rest.join('=') || null;
  }
  return null;
}

/** Raw `ms_product_preview` cookie value in the browser (DRAFT product preview on a LIVE store). */
export function readBrowserProductPreviewCookie(): string | null {
  return readBrowserPreviewCookie(PRODUCT_PREVIEW_COOKIE);
}

/**
 * Bearer of the checkout's `GET /payments/config` in the browser: the
 * owner preview token of this slug (cookie), else the stored edit-hint
 * token, else the shopper's session token. The API resolves it optionally
 * (an invalid or foreign token is just "anonymous"), and only the store
 * owner / an admin gets the TEST key + `test_mode` back. Null on the server
 * or when nothing is stored.
 */
export function checkoutViewerToken(
  slug: string,
  sources: { editHintToken: string | null; sessionToken: string | null },
): string | null {
  const preview = slug ? previewTokenFor(slug, readBrowserPreviewCookie()) : null;
  if (preview) return preview;
  if (isPlausibleToken(sources.editHintToken)) return sources.editHintToken;
  return sources.sessionToken || null;
}

/** Header that carries the checkout viewer token to the payment endpoints. */
export const STOREFRONT_VIEWER_HEADER = 'X-Storefront-Viewer';

// Bearer token charset (JWT / opaque session tokens); anything else (spaces,
// control characters) is never put in a header.
const VIEWER_TOKEN_RE = /^[A-Za-z0-9._~+/=-]{1,4096}$/;

/**
 * Extra headers for `POST /payments/create-intent` and `/payments/confirm`:
 * the same viewer token the checkout sends to `/payments/config`, so the API
 * decides owner test mode the same way for the intent. Empty without a usable
 * token. Only for requests to the platform API (never third parties).
 */
export function storefrontViewerHeaders(token: string | null | undefined): Record<string, string> {
  return token && VIEWER_TOKEN_RE.test(token) ? { [STOREFRONT_VIEWER_HEADER]: `Bearer ${token}` } : {};
}

/**
 * Viewer header of the checkout's platform calls (quote, order creation,
 * create-intent, confirm): the `checkoutViewerToken` of this slug. Lets the
 * API recognise the owner (owner test mode, pre-live test orders). Browser
 * only; empty without a usable token.
 */
export function checkoutViewerHeaders(
  slug: string,
  sources: { editHintToken: string | null; sessionToken: string | null },
): Record<string, string> {
  return storefrontViewerHeaders(checkoutViewerToken(slug, sources));
}

/**
 * Viewer header carrying only the owner preview token of this slug (cookie),
 * for cart calls that must not block the owner's pre-live test checkout.
 * Empty for every public visitor (no preview cookie).
 */
export function previewViewerHeaders(slug: string | null | undefined): Record<string, string> {
  if (!slug) return {};
  return storefrontViewerHeaders(previewTokenFor(slug, readBrowserPreviewCookie()));
}
