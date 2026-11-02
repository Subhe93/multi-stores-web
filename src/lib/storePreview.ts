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
import { STORE_PREVIEW_COOKIE, storeGate, type StoreGateFields } from './storeGate';

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

/** Raw `ms_store_preview` cookie value in the browser (null elsewhere / when absent). */
export function readBrowserPreviewCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === STORE_PREVIEW_COOKIE) return rest.join('=') || null;
  }
  return null;
}
