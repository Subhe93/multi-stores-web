// Cookie consent v2 (plans/consent-v2/CONTRACT.md, binding).
//
// Categories: necessary (always on), analytics (GA4, Microsoft Clarity),
// marketing (Meta Pixel, TikTok Pixel and Google's ad_* signals) and
// external_media (YouTube, Vimeo, Google Maps). The visitor's choice is kept
// per store in one schema-3 record:
// - localStorage `consent:<slug>` (JSON, see ConsentRecord);
// - a first-party cookie `consent_<slug>=3.<base64url(compact JSON)>` as the
//   fallback when storage is blocked (and for a future server-side read).
//
// A tracking decision (grant or refusal) is valid for 12 months, until
// CONSENT_PURPOSE_VERSION is bumped, or until the store adds a vendor to a
// category the visitor granted or was never offered (trackingDecision). The
// external-media grant has its own 12-month clock.
//
// Choices stored by the previous versions (v1/v2 tracking choice, the M110
// "always allow external videos" grant) are migrated on first read (§3.4):
// see readConsentRecord / migrateLegacy.

import { logConsent, randomUuid, type ConsentAction, type ConsentSource } from './consentLog';

export type { ConsentAction, ConsentSource } from './consentLog';

// ── Categories and vendors (§2) ──

export type ConsentCategory = 'analytics' | 'marketing' | 'external_media';
export type TrackerVendor = 'ga4' | 'clarity' | 'meta' | 'tiktok';
export type MediaVendor = 'youtube' | 'vimeo' | 'google_maps';
/**
 * Google's ad signals (ad_storage, ad_user_data, ad_personalization). Not a
 * separate tag: GA4 receives them under the marketing category, so Google is
 * named in that category too (see marketingVendorKeys).
 */
export type AdSignalVendor = 'google_ads';
export type VendorKey = TrackerVendor | MediaVendor | AdSignalVendor;

/** Proper names: identical in every locale, so not in the message files. */
export const VENDOR_LABELS: Record<VendorKey, string> = {
  ga4: 'Google Analytics (Google Ireland Ltd)',
  clarity: 'Microsoft Clarity (Microsoft Ireland Operations Ltd)',
  meta: 'Meta Pixel (Meta Platforms Ireland Ltd)',
  tiktok: 'TikTok Pixel (TikTok Technology Ltd)',
  youtube: 'YouTube (Google Ireland Ltd)',
  vimeo: 'Vimeo (Vimeo.com, Inc.)',
  google_maps: 'Google Maps (Google Ireland Ltd)',
  google_ads: 'Google Ads (Google Ireland Ltd)',
};

/** The external-media vendors (always listed: the store cannot know which pages embed them). */
export const MEDIA_VENDORS: readonly MediaVendor[] = ['youtube', 'vimeo', 'google_maps'];

/** Category each tracker vendor belongs to (fixed). */
export const TRACKER_CATEGORY: Record<TrackerVendor, 'analytics' | 'marketing'> = {
  ga4: 'analytics',
  clarity: 'analytics',
  meta: 'marketing',
  tiktok: 'marketing',
};

// ── Record format (§3.1) ──

export const CONSENT_SCHEMA = 3;
/** Bump when purposes or banner meaning change for everyone (re-prompt all). */
export const CONSENT_PURPOSE_VERSION = 3;
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months
const CONSENT_MAX_AGE_S = CONSENT_MAX_AGE_MS / 1000;

/**
 * Migration switch (§3.4, decision D7). true: an old valid "granted" becomes
 * analytics + marketing granted without a new prompt (the old banner named
 * exactly those purposes). false: former "granted" visitors are asked again
 * with the granular banner. Former refusals younger than 12 months are
 * honoured either way, whatever their legacy version. Prefer this switch over bumping
 * CONSENT_PURPOSE_VERSION, which would also re-ask people who refused.
 */
export const MIGRATE_LEGACY_GRANTED = true;

export interface ConsentRecord {
  schema: 3;
  /** Anonymous random id (crypto.randomUUID), stable for this store + browser; logged with every decision. */
  id: string;
  /** Tracking decision; null = undecided (e.g. only external media was chosen on a facade). */
  tracking: {
    pv: number; // CONSENT_PURPOSE_VERSION at decision time
    at: number; // ms
    analytics: boolean; // false when not offered
    marketing: boolean; // false when not offered
    vendors: TrackerVendor[]; // gated tracker vendors OFFERED at decision time (sorted)
  } | null;
  /** External media decision; null = never decided (facade shows). */
  external: { granted: boolean; at: number } | null;
}

// ── Public constants (§3.2) ──

/** Window event fired whenever the stored choice changes. */
export const CONSENT_CHANGE_EVENT = 'ms:consent-change';
/** Window event that asks the consent manager to open the settings dialog. */
export const CONSENT_OPEN_EVENT = 'ms:consent-open';
export const COOKIE_SETTINGS_HASH = '#cookie-settings';
/** Cookie-policy page slugs the banner links to when the store publishes one. */
// Keep identical to COOKIE_POLICY_SLUGS in multi-stores-api
// src/modules/storefront/cookie-page.ts.
export const COOKIE_POLICY_SLUGS = ['om-cookies', 'cookies', 'cookie-policy', 'cookiepolicy'];

/**
 * Root-relative href of the store's cookie page, or null when none is
 * published. The API's `cookie_page_slug` covers every published page type
 * (a LANDING page is not in `pages`); older APIs without the field fall back
 * to the published static pages. The locale prefix is applied client-side.
 */
export function cookiePolicyHref(store: {
  cookie_page_slug?: string | null;
  pages?: ReadonlyArray<{ slug: string }> | null;
}): string | null {
  if (store.cookie_page_slug) return `/${store.cookie_page_slug}`;
  const page = (store.pages ?? []).find((p) => COOKIE_POLICY_SLUGS.includes(p.slug));
  return page ? `/${page.slug}` : null;
}

export interface TrackingChoice {
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentDecisionMeta {
  action: ConsentAction;
  source: ConsentSource;
  /** sha256 hex of the rendered text, or 'legacy' / 'facade' / 'unavailable'. */
  textHash: string;
  locale: string;
}

/** Public tracking ids the storefront store payload carries. */
export interface StoreTracking {
  ga4_measurement_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  /**
   * Microsoft Clarity project id. Clarity is ALWAYS consent-gated (analytics
   * category), even when `consent_required` is false.
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

export interface StoreVendors {
  analytics: TrackerVendor[];
  marketing: TrackerVendor[];
  /** Vendors that load without consent (`consent_required === false`, D10). */
  ungated: TrackerVendor[];
}

/**
 * Vendors per category for this store (§2.2). A category is offered when its
 * list is non-empty; external media is always offered.
 */
export function storeVendors(t: StoreTracking | null | undefined): StoreVendors {
  const out: StoreVendors = { analytics: [], marketing: [], ungated: [] };
  if (!t) return out;
  const gated = t.consent_required !== false;
  if (t.ga4_measurement_id) (gated ? out.analytics : out.ungated).push('ga4');
  if (t.clarity_project_id) out.analytics.push('clarity');
  if (t.meta_pixel_id) (gated ? out.marketing : out.ungated).push('meta');
  if (t.tiktok_pixel_id) (gated ? out.marketing : out.ungated).push('tiktok');
  return out;
}

/**
 * Vendors named under Marketing: the gated pixels, plus Google when GA4 is
 * consent-gated, because a marketing grant also sends GA4 the ad_* signals
 * (Consent Mode v2, D11). Empty when the category is not offered.
 */
export function marketingVendorKeys(v: StoreVendors): VendorKey[] {
  if (v.marketing.length === 0) return [];
  return v.analytics.includes('ga4') ? [...v.marketing, 'google_ads'] : [...v.marketing];
}

function offeredVendors(t: StoreTracking | null | undefined): TrackerVendor[] {
  const v = storeVendors(t);
  return [...v.analytics, ...v.marketing].sort();
}

// ── Storage helpers ──

function storageKey(slug: string): string {
  return `consent:${slug}`;
}

function cookieName(slug: string): string {
  // Cookie names cannot carry ":"; slugs are [a-z0-9-] so they are safe.
  return `consent_${slug}`;
}

// Legacy M110 external-media keys (read and deleted by the migration only).
function legacyExternalKey(slug: string): string {
  return `consent:${slug}:external-media`;
}

function legacyExternalCookie(slug: string): string {
  // Slugs are [a-z0-9-] (no "_"), so this never collides with consent_<slug>.
  return `xmedia_${slug}`;
}

function cookieAttributes(): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  return `path=/; samesite=lax${secure}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; ${cookieAttributes()}`;
}

/** Storage value: undefined = storage unusable (throws), null = empty. */
function storageGet(key: string): string | null | undefined {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing to remove.
  }
}

function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

const TRACKER_VENDORS: readonly TrackerVendor[] = ['ga4', 'clarity', 'meta', 'tiktok'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isVendorList(v: unknown): v is TrackerVendor[] {
  return Array.isArray(v) && v.every((x) => TRACKER_VENDORS.includes(x as TrackerVendor));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validates a parsed schema-3 record; null when it is not one. */
function asRecord(value: unknown): ConsentRecord | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<ConsentRecord>;
  if (r.schema !== CONSENT_SCHEMA || typeof r.id !== 'string' || !UUID_RE.test(r.id)) return null;
  let tracking: ConsentRecord['tracking'] = null;
  if (r.tracking != null) {
    const t = r.tracking;
    if (
      !isFiniteNumber(t.pv) ||
      !isFiniteNumber(t.at) ||
      typeof t.analytics !== 'boolean' ||
      typeof t.marketing !== 'boolean' ||
      !isVendorList(t.vendors)
    ) {
      return null;
    }
    tracking = { pv: t.pv, at: t.at, analytics: t.analytics, marketing: t.marketing, vendors: [...t.vendors].sort() };
  }
  let external: ConsentRecord['external'] = null;
  if (r.external != null) {
    if (typeof r.external.granted !== 'boolean' || !isFiniteNumber(r.external.at)) return null;
    external = { granted: r.external.granted, at: r.external.at };
  }
  return { schema: CONSENT_SCHEMA, id: r.id, tracking, external };
}

interface CompactRecord {
  i: string;
  p?: number;
  t?: number;
  a?: 0 | 1;
  m?: 0 | 1;
  v?: TrackerVendor[];
  x?: 0 | 1;
  e?: number;
}

/** Cookie value `3.<base64url(compact JSON)>` (§3.1). */
export function encodeConsentCookie(rec: ConsentRecord): string {
  const c: CompactRecord = { i: rec.id };
  if (rec.tracking) {
    c.p = rec.tracking.pv;
    c.t = Math.floor(rec.tracking.at / 1000);
    c.a = rec.tracking.analytics ? 1 : 0;
    c.m = rec.tracking.marketing ? 1 : 0;
    c.v = rec.tracking.vendors;
  }
  if (rec.external) {
    c.x = rec.external.granted ? 1 : 0;
    c.e = Math.floor(rec.external.at / 1000);
  }
  return `${CONSENT_SCHEMA}.${base64UrlEncode(JSON.stringify(c))}`;
}

/** Parses a `3.<…>` cookie value; null for anything else (including legacy values). */
export function decodeConsentCookie(value: string | null): ConsentRecord | null {
  if (!value || !value.startsWith(`${CONSENT_SCHEMA}.`)) return null;
  try {
    const c = JSON.parse(base64UrlDecode(value.slice(2))) as CompactRecord;
    const hasTracking = c.p !== undefined || c.t !== undefined;
    const hasExternal = c.x !== undefined;
    return asRecord({
      schema: CONSENT_SCHEMA,
      id: c.i,
      tracking: hasTracking
        ? { pv: c.p, at: isFiniteNumber(c.t) ? c.t * 1000 : c.t, analytics: c.a === 1, marketing: c.m === 1, vendors: c.v ?? [] }
        : null,
      external: hasExternal ? { granted: c.x === 1, at: isFiniteNumber(c.e) ? c.e * 1000 : c.e } : null,
    });
  } catch {
    return null;
  }
}

// Records whose localStorage write could not be confirmed AND whose previous
// localStorage value could not be removed either (storage half broken). They
// are served from memory for the rest of this document, so reads stay stable
// (same id, no repeated migration and log) and the old value never wins.
const unsavedRecords = new Map<string, ConsentRecord>();

function writeRecord(slug: string, rec: ConsentRecord): void {
  const key = storageKey(slug);
  const json = JSON.stringify(rec);
  try {
    window.localStorage.setItem(key, json);
  } catch {
    // Storage blocked or full: the cookie below still carries the record.
  }
  // A failed write (e.g. quota exceeded while reads still work) leaves the
  // previous value (e.g. a legacy choice) in place, and it would win over the
  // cookie on every read. Remove it so reads fall through to the cookie.
  const stored = storageGet(key);
  if (stored && stored !== json) storageRemove(key);
  const left = storageGet(key);
  if (left && left !== json) unsavedRecords.set(slug, rec);
  else unsavedRecords.delete(slug);
  document.cookie = `${cookieName(slug)}=${encodeConsentCookie(rec)}; max-age=${CONSENT_MAX_AGE_S}; ${cookieAttributes()}`;
  // The M110 external-media keys are superseded by the record. Deleting them
  // matters: after a rollback a stale legacy grant must not resurrect a
  // choice withdrawn under v3.
  if (storageGet(legacyExternalKey(slug))) storageRemove(legacyExternalKey(slug));
  if (readCookie(legacyExternalCookie(slug)) !== null) deleteCookie(legacyExternalCookie(slug));
}

function notify(): void {
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

function documentLocale(): string {
  return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
}

// ── Store tracking registry ──
//
// The legacy migration needs the store's trackers (a v1 choice is not valid
// on a Clarity store; the migrated record lists the vendors offered). Every
// call that receives `tracking` registers it here, so callers that only know
// the slug (externalMediaAllowed, facades) migrate with the same data.
// `undefined` = not known yet: legacy keys are then read without migrating.

const knownTracking = new Map<string, StoreTracking | null>();

function resolveTracking(slug: string, t: StoreTracking | null | undefined): StoreTracking | null | undefined {
  if (t !== undefined) {
    knownTracking.set(slug, t);
    return t;
  }
  return knownTracking.has(slug) ? knownTracking.get(slug) : undefined;
}

// ── Legacy migration (§3.4) ──

const LEGACY_REQUIRED_CLARITY = 2;
const LEGACY_DEFAULT_VERSION = 1;

let migrateLegacyGranted = MIGRATE_LEGACY_GRANTED;

/** Test hook for the MIGRATE_LEGACY_GRANTED switch. */
export function __setMigrateLegacyGrantedForTests(value: boolean | null): void {
  migrateLegacyGranted = value === null ? MIGRATE_LEGACY_GRANTED : value;
}

interface LegacyTracking {
  granted: boolean;
  at: number;
  v: number;
  /** Read from the legacy cookie, which carries no decision time. */
  cookieOnly: boolean;
}

function parseLegacyTrackingStorage(raw: string): LegacyTracking | null | 'invalid' {
  try {
    const p = JSON.parse(raw) as { choice?: unknown; at?: unknown; v?: unknown; schema?: unknown };
    if (!p || typeof p !== 'object' || p.schema !== undefined) return 'invalid';
    if (p.choice !== 'granted' && p.choice !== 'denied') return 'invalid';
    if (!isFiniteNumber(p.at)) return 'invalid';
    const v = p.v === undefined ? LEGACY_DEFAULT_VERSION : p.v;
    if (!isFiniteNumber(v)) return 'invalid';
    return { granted: p.choice === 'granted', at: p.at, v, cookieOnly: false };
  } catch {
    return 'invalid';
  }
}

function parseLegacyTrackingCookie(value: string | null, now: number): LegacyTracking | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  const choice = dot < 0 ? value : value.slice(0, dot);
  const v = dot < 0 ? LEGACY_DEFAULT_VERSION : Number(value.slice(dot + 1));
  if (!Number.isInteger(v)) return null;
  if (choice !== 'granted' && choice !== 'denied') return null;
  // The cookie has no decision time and its max-age was 365 days, so it may
  // be almost a year old. Only a refusal is migrated from it (at = now:
  // keeping a refusal longer never enables a tracker); a grant is asked
  // again, so no consent outlives 12 months (§3.4).
  return { granted: choice === 'granted', at: now, v, cookieOnly: true };
}

/** The M110 external grant (`{choice:'granted', at, v:1}` / `granted.1`), when valid. */
function readLegacyExternal(slug: string, now: number): { at: number } | null | 'present-invalid' {
  const raw = storageGet(legacyExternalKey(slug));
  if (raw) {
    try {
      const p = JSON.parse(raw) as { choice?: unknown; at?: unknown; v?: unknown };
      const v = isFiniteNumber(p?.v) ? p.v : 0;
      if (p?.choice === 'granted' && isFiniteNumber(p.at) && now - p.at < CONSENT_MAX_AGE_MS && v >= 1) {
        return { at: p.at };
      }
    } catch {
      // Unreadable: counts as present but invalid.
    }
    return 'present-invalid';
  }
  if (raw === null || raw === undefined) {
    // The cookie (`granted.1`) has no decision time and may be up to a year
    // old, so it is not migrated: the facade simply asks again (§3.4).
    return readCookie(legacyExternalCookie(slug)) ? 'present-invalid' : null;
  }
  return null;
}

/**
 * Builds (and, when the store's trackers are known, persists + logs) the
 * schema-3 record from the legacy keys. Returns null when nothing legacy
 * exists. `legacyTracking` is the already-located legacy tracking entry.
 */
function migrateLegacy(
  slug: string,
  legacyTracking: LegacyTracking | null,
  t: StoreTracking | null | undefined,
  now: number,
): ConsentRecord | null {
  const legacyExternal = readLegacyExternal(slug, now);
  const hadLegacyExternal = legacyExternal !== null;
  if (!legacyTracking && !hadLegacyExternal) return null;

  const known = t !== undefined;
  // Unknown store trackers: assume Clarity (stricter version rule) and list
  // no vendors, so the transient view can only ask more, never less.
  const required = !known || t?.clarity_project_id ? LEGACY_REQUIRED_CLARITY : LEGACY_DEFAULT_VERSION;
  let tracking: ConsentRecord['tracking'] = null;
  // A refusal younger than 12 months is honoured whatever its version or
  // source (honouring it never enables a tracker). A grant migrates only when
  // the switch allows it, its version covers this store's purposes and its
  // decision time is known (localStorage, not the cookie).
  if (
    legacyTracking &&
    now - legacyTracking.at < CONSENT_MAX_AGE_MS &&
    (!legacyTracking.granted ||
      (migrateLegacyGranted && legacyTracking.v >= required && !legacyTracking.cookieOnly))
  ) {
    const g = legacyTracking.granted;
    tracking = {
      pv: CONSENT_PURPOSE_VERSION,
      at: legacyTracking.at,
      analytics: g,
      marketing: g,
      vendors: known ? offeredVendors(t) : [],
    };
  }
  const external = legacyExternal && legacyExternal !== 'present-invalid' ? { granted: true, at: legacyExternal.at } : null;
  // Nothing valid to carry over: no record, no consent id and no log row (a
  // "migrated" row that records no choice proves nothing). The stale legacy
  // keys stay until the visitor decides; writeRecord then replaces them.
  if (!tracking && !external) return null;
  const rec: ConsentRecord = { schema: CONSENT_SCHEMA, id: randomUuid(), tracking, external };
  if (!known) return rec;

  writeRecord(slug, rec);
  logConsent(slug, rec, { action: 'migrated', source: 'migration', textHash: 'legacy', locale: documentLocale() }, t);
  return rec;
}

/**
 * The visitor's schema-3 record for this store, or null when nothing was
 * ever stored. Read precedence (§3.1): a schema-3 localStorage entry wins; a
 * present but invalid entry counts as nothing; the cookie is used only when
 * localStorage is empty or throws; legacy keys are migrated on first read.
 * `t` (optional) is the store's tracking config; it is remembered per slug.
 */
export function readConsentRecord(slug: string, t?: StoreTracking | null): ConsentRecord | null {
  if (typeof window === 'undefined' || !slug) return null;
  const tracking = resolveTracking(slug, t);
  const unsaved = unsavedRecords.get(slug);
  if (unsaved) return unsaved;
  const now = Date.now();
  const raw = storageGet(storageKey(slug));
  if (raw) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const rec = asRecord(parsed);
    if (rec) return rec;
    const legacy = parseLegacyTrackingStorage(raw);
    if (legacy !== 'invalid') return migrateLegacy(slug, legacy, tracking, now);
    // Present but invalid: counts as "nothing" (external legacy may remain).
    return migrateLegacy(slug, null, tracking, now);
  }
  // localStorage empty (null) or unusable (undefined): the cookie.
  const cookie = readCookie(cookieName(slug));
  const fromCookie = decodeConsentCookie(cookie);
  if (fromCookie) return fromCookie;
  return migrateLegacy(slug, parseLegacyTrackingCookie(cookie, now), tracking, now);
}

// ── Decisions (§3.3) ──

/** Valid tracking decision for this store, or null = must ask (§3.3). */
export function trackingDecision(
  rec: ConsentRecord | null,
  t: StoreTracking | null | undefined,
  now: number = Date.now(),
): TrackingChoice | null {
  const tr = rec?.tracking;
  if (!tr) return null;
  if (now - tr.at >= CONSENT_MAX_AGE_MS) return null;
  if (tr.pv < CONSENT_PURPOSE_VERSION) return null;
  const current = storeVendors(t);
  for (const category of ['analytics', 'marketing'] as const) {
    const offeredBefore = tr.vendors.some((v) => TRACKER_CATEGORY[v] === category);
    const added = current[category].some((v) => !tr.vendors.includes(v));
    if (added && (tr[category] || !offeredBefore)) return null;
  }
  return {
    analytics: current.analytics.length > 0 && tr.analytics,
    marketing: current.marketing.length > 0 && tr.marketing,
  };
}

function externalValid(rec: ConsentRecord | null, now: number): boolean {
  return rec?.external?.granted === true && now - rec.external.at < CONSENT_MAX_AGE_MS;
}

/** True while the visitor allows external media (YouTube, Vimeo, Google Maps) for this store. */
export function externalMediaAllowed(slug: string): boolean {
  if (typeof window === 'undefined' || !slug) return false;
  return externalValid(readConsentRecord(slug), Date.now());
}

function baseRecord(slug: string, t?: StoreTracking | null): ConsentRecord {
  const rec = readConsentRecord(slug, t);
  return rec ?? { schema: CONSENT_SCHEMA, id: randomUuid(), tracking: null, external: null };
}

/**
 * Stores a banner / dialog decision (categories that are not offered are
 * saved as false), writes storage + cookie, notifies and logs it.
 */
export function saveTrackingChoice(
  slug: string,
  choice: TrackingChoice & { external_media?: boolean },
  t: StoreTracking | null | undefined,
  meta: ConsentDecisionMeta,
): void {
  if (typeof window === 'undefined' || !slug) return;
  const now = Date.now();
  const offered = storeVendors(t);
  const prev = baseRecord(slug, t ?? null);
  const rec: ConsentRecord = {
    schema: CONSENT_SCHEMA,
    id: prev.id,
    tracking: {
      pv: CONSENT_PURPOSE_VERSION,
      at: now,
      analytics: choice.analytics && offered.analytics.length > 0,
      marketing: choice.marketing && offered.marketing.length > 0,
      vendors: [...offered.analytics, ...offered.marketing].sort(),
    },
    external: choice.external_media === undefined ? prev.external : { granted: choice.external_media, at: now },
  };
  writeRecord(slug, rec);
  notify();
  logConsent(slug, rec, meta, t);
}

/** Stores the external-media decision alone (facade, or a store without gated trackers). */
export function setExternalMedia(slug: string, granted: boolean, meta: ConsentDecisionMeta): void {
  const rec = writeExternal(slug, granted);
  if (rec) logConsent(slug, rec, meta, knownTracking.get(slug));
}

/** Writes the external-media decision and notifies (synchronously); null on the server. */
function writeExternal(slug: string, granted: boolean): ConsentRecord | null {
  if (typeof window === 'undefined' || !slug) return null;
  const prev = baseRecord(slug);
  const rec: ConsentRecord = { ...prev, external: { granted, at: Date.now() } };
  writeRecord(slug, rec);
  notify();
  return rec;
}

/** Asks the consent manager (<StoreTracking>) to open the settings dialog. */
export function openConsentSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
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
    if (e.key === null || e.key.startsWith(storageKey(''))) onChange();
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

// ── Snapshot (useSyncExternalStore) ──

/**
 * useSyncExternalStore snapshot: a PRIMITIVE string, stable between calls.
 * Format `"<a|A|-><m|M|-><x|X|->|<id>|<atSec>"` (upper case = granted, lower
 * case = denied, `-` = undecided or not offered), `"?"` on the server.
 * `atSec` is the tracking decision time, else the external decision time.
 */
export function consentSnapshot(slug: string, t: StoreTracking | null | undefined): string {
  if (typeof window === 'undefined') return '?';
  const now = Date.now();
  const rec = readConsentRecord(slug, t ?? null);
  const decision = trackingDecision(rec, t, now);
  const offered = storeVendors(t);
  const a = !decision || offered.analytics.length === 0 ? '-' : decision.analytics ? 'A' : 'a';
  const m = !decision || offered.marketing.length === 0 ? '-' : decision.marketing ? 'M' : 'm';
  const x = externalValid(rec, now) ? 'X' : rec?.external && !rec.external.granted ? 'x' : '-';
  const at = decision && rec?.tracking ? rec.tracking.at : rec?.external ? rec.external.at : null;
  return `${a}${m}${x}|${rec?.id ?? ''}|${at === null ? '' : Math.floor(at / 1000)}`;
}

export interface ParsedConsentSnapshot {
  tracking: TrackingChoice | null;
  external: boolean;
  id: string | null;
  /** Decision time in ms (second precision), or null. */
  at: number | null;
}

export function parseConsentSnapshot(s: string): ParsedConsentSnapshot {
  const [flags = '', id = '', atSec = ''] = s.split('|');
  if (flags.length !== 3) return { tracking: null, external: false, id: null, at: null };
  const [a, m, x] = flags;
  const tracking = a === '-' && m === '-' ? null : { analytics: a === 'A', marketing: m === 'M' };
  const at = atSec === '' ? null : Number(atSec) * 1000;
  return { tracking, external: x === 'X', id: id || null, at: Number.isFinite(at) ? at : null };
}

// ── M110 wrappers (kept so existing callers keep compiling) ──

/** = externalMediaAllowed. */
export function readExternalMediaConsent(slug: string): boolean {
  return externalMediaAllowed(slug);
}

/**
 * "Always allow external media" on a facade. `textHash` is the sha256 of the
 * facade notice the visitor acted on (§5.4): pass the pending
 * `consentTextHash(noticeEl)` (it reads the text synchronously). The grant is
 * stored at once; only the log row waits for the hash. 'facade' = unknown.
 */
export function grantExternalMediaConsent(slug: string, textHash: string | Promise<string> = 'facade'): void {
  const rec = writeExternal(slug, true);
  if (!rec) return;
  const t = knownTracking.get(slug);
  const locale = documentLocale();
  const log = (hash: string) =>
    logConsent(slug, rec, { action: 'external_media_grant', source: 'facade', textHash: hash, locale }, t);
  if (typeof textHash === 'string') log(textHash);
  else void textHash.then(log, () => log('facade'));
}

/** Withdraws the external-media grant. */
export function clearExternalMediaConsent(slug: string): void {
  setExternalMedia(slug, false, {
    action: 'external_media_revoke',
    source: 'dialog',
    textHash: 'unavailable',
    locale: documentLocale(),
  });
}

/**
 * Test helper: forgets everything stored for a store (schema-3 record and
 * legacy keys) without logging, and notifies subscribers.
 */
export function __clearConsentForTests(slug: string): void {
  if (typeof window === 'undefined') return;
  storageRemove(storageKey(slug));
  storageRemove(legacyExternalKey(slug));
  unsavedRecords.delete(slug);
  deleteCookie(cookieName(slug));
  deleteCookie(legacyExternalCookie(slug));
  knownTracking.delete(slug);
  notify();
}

// ── Active trackers (unchanged) ──

// Whether each vendor tag is mounted right now for THIS store. <TrackingScripts>
// owns ga4/meta/tiktok (set on mount, cleared on unmount, e.g. consent
// withdrawn); <ClarityScript> owns clarity. Checkout reads the Meta flag
// before sending the Meta browser ids to the API.
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
  // The Clarity flag has its own owner (<ClarityScript>), so keep it here.
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
