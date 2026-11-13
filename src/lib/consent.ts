// Cookie consent (Namez go-live 3.9): the visitor's choice is stored twice —
// in localStorage (per store, with a timestamp) for the client and in a
// first-party cookie (per store) so a server component can read it later.
// Both expire after one year; `clearConsent` re-opens the banner.
//
// Every stored choice carries CONSENT_VERSION. A choice saved under an older
// version than the store requires counts as "no choice", so the banner asks
// again where the purposes changed. v2 added Microsoft Clarity session
// recordings, so only stores with a Clarity id require v2; every other store
// still honours a v1 choice (a stored entry without `v`, a bare cookie).

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_MAX_AGE_S = 365 * 24 * 60 * 60;
/** Bump whenever the vendor list or the purposes behind "accept" change. */
export const CONSENT_VERSION = 2;
/** Choices from before versioning (no `v`, bare cookie value) count as v1. */
export const LEGACY_CONSENT_VERSION = 1;

/** The version a store's visitors must have chosen under (v2 = Clarity recordings). */
export function requiredConsentVersion(tracking: { clarity_project_id?: string | null } | null | undefined): number {
  return tracking?.clarity_project_id ? CONSENT_VERSION : LEGACY_CONSENT_VERSION;
}
/** Window event fired whenever the stored choice changes. */
export const CONSENT_CHANGE_EVENT = 'ms:consent-change';

export interface StoredConsent {
  choice: ConsentChoice;
  /** Unix ms when the choice was made. */
  at: number;
  /** CONSENT_VERSION the choice was made under. */
  v: number;
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

/** Cookie value: `<choice>.<version>`; a bare legacy `granted` is a v1 choice. */
function cookieValue(choice: ConsentChoice): string {
  return `${choice}.${CONSENT_VERSION}`;
}

function parseCookieValue(value: string | null, required: number): ConsentChoice | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  const choice = dot < 0 ? value : value.slice(0, dot);
  const version = dot < 0 ? LEGACY_CONSENT_VERSION : Number(value.slice(dot + 1));
  if (!Number.isInteger(version) || version < required) return null;
  return isChoice(choice) ? choice : null;
}

function cookieAttributes(): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  return `path=/; samesite=lax${secure}`;
}

function notify(): void {
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/**
 * Choice stored for this store, or null when the visitor has not decided, it
 * expired, or it was made under an older version than `requiredVersion`
 * (default: the current one; see requiredConsentVersion).
 */
export function readConsent(storeSlug: string, requiredVersion: number = CONSENT_VERSION): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(consentStorageKey(storeSlug));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredConsent>;
      const fresh = typeof parsed?.at === 'number' && Date.now() - parsed.at < CONSENT_MAX_AGE_S * 1000;
      const version = parsed?.v === undefined ? LEGACY_CONSENT_VERSION : parsed.v;
      if (fresh && typeof version === 'number' && version >= requiredVersion && isChoice(parsed.choice)) {
        return parsed.choice;
      }
    }
  } catch {
    // Storage blocked (private mode, quota): fall through to the cookie.
  }
  const name = consentCookieName(storeSlug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return parseCookieValue(match ? decodeURIComponent(match[1]) : null, requiredVersion);
}

/** Persist the choice in localStorage and the first-party cookie. */
export function writeConsent(storeSlug: string, choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  const stored: StoredConsent = { choice, at: Date.now(), v: CONSENT_VERSION };
  try {
    window.localStorage.setItem(consentStorageKey(storeSlug), JSON.stringify(stored));
  } catch {
    // Storage blocked: the cookie below still carries the choice.
  }
  document.cookie = `${consentCookieName(storeSlug)}=${cookieValue(choice)}; max-age=${CONSENT_MAX_AGE_S}; ${cookieAttributes()}`;
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

/**
 * Subscribe to consent changes (useSyncExternalStore shape): this window's
 * writes, and other tabs' through the `storage` event, so a withdrawal in
 * one tab stops the trackers in every open tab of the store.
 */
export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    // key null = the other tab cleared all storage.
    if (e.key === null || e.key.startsWith(consentStorageKey(''))) onChange();
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Public tracking ids the storefront store payload carries. */
export interface StoreTracking {
  ga4_measurement_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  /**
   * Microsoft Clarity project id. Clarity is ALWAYS consent-gated: it loads
   * only after "accept", even when `consent_required` is false.
   */
  clarity_project_id?: string | null;
  consent_required?: boolean;
}

/** True when at least one tracker is configured. */
export function hasTrackingIds(tracking: StoreTracking | null | undefined): boolean {
  if (!tracking) return false;
  return Boolean(
    tracking.ga4_measurement_id || tracking.meta_pixel_id || tracking.tiktok_pixel_id || tracking.clarity_project_id,
  );
}

// Whether the Meta pixel is mounted right now: the store has a pixel id AND
// tracking is allowed (consent granted, or not required). <TrackingScripts>
// owns the flag (set on mount, cleared on unmount, e.g. consent withdrawn);
// checkout reads it before sending the Meta browser ids to the API.
export interface ActiveTrackers {
  ga4: boolean;
  meta: boolean;
  tiktok: boolean;
  /** Clarity tag mounted (owned by <ClarityScript>, see setClarityActive). */
  clarity: boolean;
}

const NO_TRACKERS: ActiveTrackers = { ga4: false, meta: false, tiktok: false, clarity: false };
let activeTrackers: ActiveTrackers = NO_TRACKERS;

/**
 * Which vendor tags are mounted right now for THIS store (set by
 * TrackingScripts on mount, cleared on unmount). The vendor globals
 * (`fbq`, `gtag`, `ttq`) outlive the component — after consent is withdrawn,
 * or after a client navigation to another store — so event code must check
 * this state, not the globals alone.
 */
export function setActiveTrackers(next: Partial<ActiveTrackers> | null): void {
  // The Clarity flag has its own owner (<ClarityScript>, mounted separately
  // because Clarity has its own consent and route gate), so keep it here.
  const clarity = activeTrackers.clarity;
  activeTrackers = next ? { ...NO_TRACKERS, ...next, clarity } : { ...NO_TRACKERS, clarity };
}

export function setClarityActive(active: boolean): void {
  activeTrackers = { ...activeTrackers, clarity: active };
}

export function getActiveTrackers(): ActiveTrackers {
  return activeTrackers;
}

export function setMetaPixelActive(active: boolean): void {
  activeTrackers = { ...activeTrackers, meta: active };
}

export function isMetaPixelActive(): boolean {
  return activeTrackers.meta;
}

/** Cookie-policy page slugs the banner links to when the store publishes one. */
export const COOKIE_POLICY_SLUGS = ['om-cookies', 'cookies', 'cookie-policy', 'cookiepolicy'];
