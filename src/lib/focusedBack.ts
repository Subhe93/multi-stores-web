// ── Focused storefront: "back to the page the buyer came from" ───────────────
// A buy link on the external site may carry `?back=<path>`: the path of the
// site page the buyer clicked on. The store remembers it for the tab and its
// "back" links (header logo, back link, cart "continue shopping", empty cart)
// lead to that page instead of the site root.
//
// The value comes from the URL, so it is never trusted:
//   - only a PATH is accepted (`parseBackPath`), never a URL;
//   - the back URL is always the stored external site origin + that path, and
//     the result is checked again with the external-site helpers
//     (`focusedBackUrl`), so the host can never be anything but the site.
// Pure helpers plus a guarded sessionStorage pair; no `next/*` imports.

import { isExternalHostAllowed, parseExternalUrl } from './externalReturn';

/** Query parameter of the product link. */
export const BACK_PARAM = 'back';
/** Longest accepted path (query and fragment included). */
export const MAX_BACK_PATH_LENGTH = 300;

// Percent-encoded backslash or control character (%00-%1F, %7F).
const ENCODED_UNSAFE_RE = /%(?:5c|[01][0-9a-f]|7f)/i;
// Whitespace and control characters, raw.
const RAW_UNSAFE_RE = /[\s\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/**
 * The `back` value as a same-site path, or null when it breaks a rule:
 *   - a string of 1..300 characters that starts with exactly one `/`;
 *   - no `//` anywhere, no backslash, no whitespace or control character;
 *   - no percent-encoded backslash or control character, and no encoded
 *     slash right after the leading one (`/%2F…`).
 * A scheme (`https://x`, `javascript:…`) can never pass: the value has to
 * start with `/` and may not contain `//`. Query and fragment are allowed
 * (`/ok/path/?a=b#c`). The value is expected already URL-decoded once (as
 * `URLSearchParams.get` returns it).
 */
export function parseBackPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw || raw.length > MAX_BACK_PATH_LENGTH) return null;
  if (raw[0] !== '/') return null;
  if (raw.includes('//') || raw.includes('\\')) return null;
  if (RAW_UNSAFE_RE.test(raw)) return null;
  if (ENCODED_UNSAFE_RE.test(raw)) return null;
  if (/^\/%2f/i.test(raw)) return null;
  return raw;
}

/**
 * The back URL: the external site origin + the validated path. Null when the
 * path is refused, the site is not a valid external site, or the result does
 * not stay on the site origin.
 */
export function focusedBackUrl(siteUrl: string | null | undefined, rawPath: unknown): string | null {
  const path = parseBackPath(rawPath);
  const site = parseExternalUrl(siteUrl);
  if (!path || !site) return null;
  let origin: string;
  let url: URL;
  try {
    origin = new URL(site).origin;
    url = new URL(path, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const checked = parseExternalUrl(url.href);
  if (!checked || !isExternalHostAllowed(checked, site)) return null;
  return checked;
}

/** The validated `back` path of a query string (`location.search`), or null. */
export function readBackParam(search: string | null | undefined): string | null {
  if (!search) return null;
  try {
    return parseBackPath(new URLSearchParams(search).get(BACK_PARAM));
  } catch {
    return null;
  }
}

// ── Tab memory (sessionStorage) ──────────────────────────────────────────────
// Keyed by the external site host: one store has one site, and the storage is
// already scoped to the store's own origin. Only the PATH is stored and it is
// validated again on every read. Storage can be missing or throw (private
// mode, blocked site data): the back link then simply stays the site root.

function storageKey(siteHost: string): string {
  return `ms-focus-back:${siteHost}`;
}

/** The remembered back path of this tab, or null. */
export function readRememberedBack(siteHost: string | null | undefined): string | null {
  if (!siteHost || typeof window === 'undefined') return null;
  try {
    return parseBackPath(window.sessionStorage.getItem(storageKey(siteHost)));
  } catch {
    return null;
  }
}

/** Remembers a back path for this tab; false when it was refused or not stored. */
export function rememberBack(siteHost: string | null | undefined, rawPath: unknown): boolean {
  const path = parseBackPath(rawPath);
  if (!siteHost || !path || typeof window === 'undefined') return false;
  try {
    window.sessionStorage.setItem(storageKey(siteHost), path);
    return true;
  } catch {
    return false;
  }
}
