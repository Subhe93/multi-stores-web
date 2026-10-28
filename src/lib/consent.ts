// Cookie consent (Namez go-live 3.9): the visitor's choice is stored twice —
// in localStorage (per store, with a timestamp) for the client and in a
// first-party cookie (per store) so a server component can read it later.
// Both expire after one year; `clearConsent` re-opens the banner.

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_MAX_AGE_S = 365 * 24 * 60 * 60;
/** Window event fired whenever the stored choice changes. */
export const CONSENT_CHANGE_EVENT = 'ms:consent-change';

export interface StoredConsent {
  choice: ConsentChoice;
  /** Unix ms when the choice was made. */
  at: number;
}

export function consentStorageKey(storeSlug: string): string {
  return `consent:${storeSlug}`;
}

export function consentCookieName(storeSlug: string): string {
  // Cookie names cannot carry ":"; slugs are [a-z0-9-] so they are safe.
  return `consent_${storeSlug}`;
}

function isChoice(value: unknown): value is ConsentChoice {
  return value === 'granted' || value === 'denied';
}

function cookieAttributes(): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  return `path=/; samesite=lax${secure}`;
}

function notify(): void {
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** Choice stored for this store, or null when the visitor has not decided (or it expired). */
export function readConsent(storeSlug: string): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(consentStorageKey(storeSlug));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredConsent>;
      const fresh = typeof parsed?.at === 'number' && Date.now() - parsed.at < CONSENT_MAX_AGE_S * 1000;
      if (fresh && isChoice(parsed.choice)) return parsed.choice;
    }
  } catch {
    // Storage blocked (private mode, quota): fall through to the cookie.
  }
  const name = consentCookieName(storeSlug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  const fromCookie = match ? decodeURIComponent(match[1]) : null;
  return isChoice(fromCookie) ? fromCookie : null;
}

/** Persist the choice in localStorage and the first-party cookie. */
export function writeConsent(storeSlug: string, choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  const stored: StoredConsent = { choice, at: Date.now() };
  try {
    window.localStorage.setItem(consentStorageKey(storeSlug), JSON.stringify(stored));
  } catch {
    // Storage blocked: the cookie below still carries the choice.
  }
  document.cookie = `${consentCookieName(storeSlug)}=${choice}; max-age=${CONSENT_MAX_AGE_S}; ${cookieAttributes()}`;
  notify();
}

/** Forget the choice (storage + cookie) so the banner shows again. */
export function clearConsent(storeSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(consentStorageKey(storeSlug));
  } catch {
    // Storage blocked: nothing to remove.
  }
  document.cookie = `${consentCookieName(storeSlug)}=; max-age=0; ${cookieAttributes()}`;
  notify();
}

/** Subscribe to consent changes (useSyncExternalStore shape). */
export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

/** Public tracking ids the storefront store payload carries. */
export interface StoreTracking {
  ga4_measurement_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  consent_required?: boolean;
}

/** True when at least one tracker is configured. */
export function hasTrackingIds(tracking: StoreTracking | null | undefined): boolean {
  if (!tracking) return false;
  return Boolean(tracking.ga4_measurement_id || tracking.meta_pixel_id || tracking.tiktok_pixel_id);
}

/** Cookie-policy page slugs the banner links to when the store publishes one. */
export const COOKIE_POLICY_SLUGS = ['om-cookies', 'cookies', 'cookie-policy', 'cookiepolicy'];
