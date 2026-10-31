/**
 * Store-owner "Edit" button — the always-loaded half (kept tiny on purpose).
 *
 * The dashboard opens the storefront with `#ms_edit=<token>` (a URL
 * fragment, so the token never reaches the server, its logs, the cache key
 * or a Referer header; `?ms_edit=` is accepted as well). On mount the
 * token is moved to localStorage and stripped from the address bar.
 * Visitors without a stored token pay nothing more: no network request,
 * no cookie, no extra chunk.
 */

export const EDIT_HINT_PARAM = 'ms_edit';
export const EDIT_HINT_STORAGE_KEY = 'ms_edit_hint';
export const EDIT_HINT_DISMISSED_KEY = 'ms_edit_hint_dismissed';

/** Plausible JWT: three base64url parts, bounded length. */
const TOKEN_RE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export function isPlausibleToken(value: string | null | undefined): value is string {
  return !!value && value.length <= 2048 && TOKEN_RE.test(value);
}

/**
 * The hand-off token carried by a URL fragment, and the same URL without it
 * (path + query + fragment); null when the URL carries none. Only the
 * fragment form is accepted: a query value would reach server logs.
 */
export function takeHandoffToken(href: string): { token: string | null; cleanUrl: string } | null {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const fromHash = hash.get(EDIT_HINT_PARAM);
  if (fromHash === null) return null;
  hash.delete(EDIT_HINT_PARAM);
  const rest = hash.toString();
  url.hash = rest ? `#${rest}` : '';
  return {
    token: isPlausibleToken(fromHash) ? fromHash : null,
    cleanUrl: `${url.pathname}${url.search}${url.hash}`,
  };
}

export function readEditHintToken(): string | null {
  try {
    const value = window.localStorage.getItem(EDIT_HINT_STORAGE_KEY);
    return isPlausibleToken(value) ? value : null;
  } catch {
    return null;
  }
}

export function forgetEditHintToken(): void {
  try {
    window.localStorage.removeItem(EDIT_HINT_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Moves a hand-off token from the address bar to localStorage and strips
 * it from the URL (keeping Next's history state). Never throws.
 */
export function consumeEditHintHandoff(): void {
  try {
    const found = takeHandoffToken(window.location.href);
    if (!found) return;
    window.history.replaceState(window.history.state, '', found.cleanUrl);
    if (found.token) {
      window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, found.token);
      // A fresh hand-off from the dashboard brings a dismissed button back.
      window.sessionStorage.removeItem(EDIT_HINT_DISMISSED_KEY);
    }
  } catch {
    /* storage or history unavailable: nothing to do */
  }
}
