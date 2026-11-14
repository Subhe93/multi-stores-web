// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_OPEN_EVENT,
  CONSENT_PURPOSE_VERSION,
  __clearConsentForTests,
  __setMigrateLegacyGrantedForTests,
  clearExternalMediaConsent,
  consentSnapshot,
  decodeConsentCookie,
  encodeConsentCookie,
  externalMediaAllowed,
  getActiveTrackers,
  grantExternalMediaConsent,
  hasTrackingIds,
  marketingVendorKeys,
  openConsentSettings,
  parseConsentSnapshot,
  readConsentRecord,
  readExternalMediaConsent,
  saveTrackingChoice,
  setActiveTrackers,
  setClarityActive,
  setExternalMedia,
  storeVendors,
  subscribeConsent,
  trackingDecision,
  type ConsentDecisionMeta,
  type ConsentRecord,
  type StoreTracking,
} from './consent';
import { logConsent } from './consentLog';

// Consent v2 (plans/consent-v2/CONTRACT.md §3, §9 web-core).

vi.mock('./consentLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./consentLog')>();
  return { ...actual, logConsent: vi.fn() };
});

const SLUG = 'namez-se';
const KEY = `consent:${SLUG}`;
const COOKIE = `consent_${SLUG}`;
const XKEY = `consent:${SLUG}:external-media`;
const XCOOKIE = `xmedia_${SLUG}`;
const META: ConsentDecisionMeta = { action: 'save', source: 'dialog', textHash: 'unavailable', locale: 'sv' };

const FULL: StoreTracking = {
  ga4_measurement_id: 'G-ABCD1234',
  meta_pixel_id: '1234567890',
  tiktok_pixel_id: null,
  clarity_project_id: 'sxtuobatm6',
  consent_required: true,
};
const NO_CLARITY: StoreTracking = { ...FULL, clarity_project_id: null };

function cookieValue(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function reset() {
  __clearConsentForTests(SLUG);
  window.localStorage.clear();
  vi.mocked(logConsent).mockClear();
  __setMigrateLegacyGrantedForTests(null);
}

function rec(partial: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    schema: 3,
    id: '6f1c1f0e-3a5b-4c1d-9e2f-0a1b2c3d4e5f',
    tracking: {
      pv: CONSENT_PURPOSE_VERSION,
      at: Date.now(),
      analytics: true,
      marketing: false,
      vendors: ['clarity', 'ga4', 'meta'],
    },
    external: null,
    ...partial,
  };
}

beforeEach(reset);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  reset();
});

describe('storeVendors', () => {
  it('splits configured vendors into categories', () => {
    expect(storeVendors(FULL)).toEqual({ analytics: ['ga4', 'clarity'], marketing: ['meta'], ungated: [] });
    expect(storeVendors({ ...FULL, tiktok_pixel_id: 'C1' }).marketing).toEqual(['meta', 'tiktok']);
    expect(storeVendors(null)).toEqual({ analytics: [], marketing: [], ungated: [] });
  });

  it('consent_required=false: GA4/Meta/TikTok are ungated, Clarity stays in analytics', () => {
    expect(storeVendors({ ...FULL, tiktok_pixel_id: 'C1', consent_required: false })).toEqual({
      analytics: ['clarity'],
      marketing: [],
      ungated: ['ga4', 'meta', 'tiktok'],
    });
  });

  it('marketingVendorKeys names Google (ad signals) only when GA4 is gated and marketing is offered', () => {
    expect(marketingVendorKeys(storeVendors(FULL))).toEqual(['meta', 'google_ads']);
    expect(marketingVendorKeys(storeVendors({ ...FULL, ga4_measurement_id: null }))).toEqual(['meta']);
    expect(marketingVendorKeys(storeVendors({ ...FULL, meta_pixel_id: null }))).toEqual([]);
    expect(marketingVendorKeys(storeVendors({ ...FULL, consent_required: false }))).toEqual([]);
  });

  it('hasTrackingIds counts Clarity', () => {
    expect(hasTrackingIds({ clarity_project_id: 'sxtuobatm6' })).toBe(true);
    expect(hasTrackingIds({ clarity_project_id: null })).toBe(false);
  });
});

describe('write / read', () => {
  it('saveTrackingChoice writes localStorage + cookie, notifies and logs', () => {
    const cb = vi.fn();
    const off = subscribeConsent(cb);
    saveTrackingChoice(SLUG, { analytics: true, marketing: false, external_media: true }, FULL, META);
    off();
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as ConsentRecord;
    expect(stored.schema).toBe(3);
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.tracking).toMatchObject({ pv: CONSENT_PURPOSE_VERSION, analytics: true, marketing: false, vendors: ['clarity', 'ga4', 'meta'] });
    expect(stored.external?.granted).toBe(true);
    expect(cookieValue(COOKIE)).toMatch(/^3\./);
    expect(decodeConsentCookie(cookieValue(COOKIE))?.id).toBe(stored.id);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(logConsent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logConsent).mock.calls[0][2]).toEqual(META);
    expect(readConsentRecord(SLUG, FULL)).toEqual(stored);
  });

  it('keeps the consent id across decisions', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: true }, FULL, META);
    const id = readConsentRecord(SLUG, FULL)?.id;
    saveTrackingChoice(SLUG, { analytics: false, marketing: false }, FULL, META);
    setExternalMedia(SLUG, true, { ...META, action: 'external_media_grant', source: 'facade' });
    expect(readConsentRecord(SLUG, FULL)?.id).toBe(id);
  });

  it('saves categories that are not offered as false', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: true }, { ga4_measurement_id: 'G-1' }, META);
    expect(readConsentRecord(SLUG)?.tracking).toMatchObject({ analytics: true, marketing: false, vendors: ['ga4'] });
  });

  it('a tracking-only save keeps the external decision', () => {
    grantExternalMediaConsent(SLUG);
    saveTrackingChoice(SLUG, { analytics: false, marketing: false }, FULL, META);
    expect(externalMediaAllowed(SLUG)).toBe(true);
  });

  it('falls back to the cookie when storage throws', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: false, external_media: true }, FULL, META);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const r = readConsentRecord(SLUG, FULL);
    expect(r?.tracking).toMatchObject({ analytics: true, marketing: false });
    expect(r?.external?.granted).toBe(true);
    expect(trackingDecision(r, FULL)).toEqual({ analytics: true, marketing: false });
  });

  it('uses the cookie when localStorage is empty', () => {
    saveTrackingChoice(SLUG, { analytics: false, marketing: true }, FULL, META);
    window.localStorage.removeItem(KEY);
    expect(readConsentRecord(SLUG, FULL)?.tracking?.marketing).toBe(true);
  });

  it('an invalid localStorage entry wins over the cookie (counts as nothing)', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: true }, FULL, META);
    window.localStorage.setItem(KEY, JSON.stringify({ schema: 3, id: 'nope' }));
    expect(readConsentRecord(SLUG, FULL)).toBeNull();
  });

  it('cookie encoding round-trips (seconds precision)', () => {
    const r = rec({ external: { granted: false, at: 1_763_100_000_000 } });
    r.tracking!.at = 1_763_000_000_000;
    expect(decodeConsentCookie(encodeConsentCookie(r))).toEqual(r);
    expect(decodeConsentCookie(encodeConsentCookie(rec({ tracking: null })))?.tracking).toBeNull();
    expect(decodeConsentCookie('granted.2')).toBeNull();
  });

  it('openConsentSettings dispatches the open event', () => {
    const cb = vi.fn();
    window.addEventListener(CONSENT_OPEN_EVENT, cb);
    openConsentSettings();
    window.removeEventListener(CONSENT_OPEN_EVENT, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('trackingDecision (re-prompt rule §3.3)', () => {
  it('is null without a tracking decision', () => {
    expect(trackingDecision(null, FULL)).toBeNull();
    expect(trackingDecision(rec({ tracking: null }), FULL)).toBeNull();
  });

  it('expires after 12 months', () => {
    const r = rec();
    expect(trackingDecision(r, FULL, r.tracking!.at + CONSENT_MAX_AGE_MS - 1)).toEqual({ analytics: true, marketing: false });
    expect(trackingDecision(r, FULL, r.tracking!.at + CONSENT_MAX_AGE_MS)).toBeNull();
  });

  it('asks again after a purpose version bump', () => {
    const r = rec();
    r.tracking!.pv = CONSENT_PURPOSE_VERSION - 1;
    expect(trackingDecision(r, FULL)).toBeNull();
  });

  it('a vendor added to a granted category asks again', () => {
    // analytics granted with only ga4 offered; the store adds Clarity.
    const r = rec();
    r.tracking!.vendors = ['ga4', 'meta'];
    expect(trackingDecision(r, FULL)).toBeNull();
  });

  it('a vendor added to a denied category does not ask', () => {
    // marketing denied with meta; the store adds TikTok.
    expect(trackingDecision(rec(), { ...FULL, tiktok_pixel_id: 'C1' })).toEqual({ analytics: true, marketing: false });
  });

  it('a vendor added to a never-offered category asks', () => {
    const r = rec();
    r.tracking!.vendors = ['clarity', 'ga4'];
    r.tracking!.marketing = false;
    expect(trackingDecision(r, FULL)).toBeNull();
  });

  it('a removed vendor does not ask; a category without vendors is masked to false', () => {
    const r = rec();
    r.tracking!.marketing = true;
    expect(trackingDecision(r, { ...FULL, meta_pixel_id: null })).toEqual({ analytics: true, marketing: false });
  });

  it('external media has its own 12-month clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    grantExternalMediaConsent(SLUG);
    vi.setSystemTime(new Date('2026-12-31T00:00:00Z'));
    expect(externalMediaAllowed(SLUG)).toBe(true);
    vi.setSystemTime(new Date('2027-01-02T00:00:00Z'));
    expect(externalMediaAllowed(SLUG)).toBe(false);
  });
});

describe('snapshot', () => {
  it('is a stable primitive and parses back', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: false, external_media: true }, FULL, META);
    const a = consentSnapshot(SLUG, FULL);
    const b = consentSnapshot(SLUG, FULL);
    expect(typeof a).toBe('string');
    expect(a).toBe(b);
    expect(a).toMatch(/^AmX\|[0-9a-f-]{36}\|\d+$/);
    const p = parseConsentSnapshot(a);
    expect(p.tracking).toEqual({ analytics: true, marketing: false });
    expect(p.external).toBe(true);
    expect(p.id).toBe(readConsentRecord(SLUG)?.id);
    expect(typeof p.at).toBe('number');
  });

  it('undecided and server snapshots', () => {
    expect(consentSnapshot(SLUG, FULL)).toBe('---||');
    expect(parseConsentSnapshot('---||')).toEqual({ tracking: null, external: false, id: null, at: null });
    expect(parseConsentSnapshot('?')).toEqual({ tracking: null, external: false, id: null, at: null });
  });

  it('a revoked external grant is lower case', () => {
    clearExternalMediaConsent(SLUG);
    expect(consentSnapshot(SLUG, null).slice(0, 3)).toBe('--x');
  });
});

describe('M110 wrappers', () => {
  it('grant / read / clear external media', () => {
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    grantExternalMediaConsent(SLUG);
    expect(readExternalMediaConsent(SLUG)).toBe(true);
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'external_media_grant', source: 'facade' });
    clearExternalMediaConsent(SLUG);
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'external_media_revoke' });
  });

  it('analytics + marketing alone do not allow external media', () => {
    saveTrackingChoice(SLUG, { analytics: true, marketing: true }, FULL, META);
    expect(externalMediaAllowed(SLUG)).toBe(false);
  });

  it('is false and a no-op without a store slug', () => {
    grantExternalMediaConsent('');
    expect(readExternalMediaConsent('')).toBe(false);
  });
});

describe('subscribeConsent', () => {
  it('fires for another tab changing a consent key (storage event), not for other keys', () => {
    const onChange = vi.fn();
    const off = subscribeConsent(onChange);
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(onChange).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ms_coupon:s1' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('active trackers', () => {
  it('keeps the Clarity flag when the other vendor tags mount or unmount', () => {
    setClarityActive(true);
    setActiveTrackers({ ga4: true });
    expect(getActiveTrackers()).toMatchObject({ ga4: true, clarity: true });
    setActiveTrackers(null);
    expect(getActiveTrackers()).toMatchObject({ ga4: false, clarity: true });
    setClarityActive(false);
    expect(getActiveTrackers().clarity).toBe(false);
  });
});

describe('legacy migration (§3.4)', () => {
  const legacy = (choice: string, at: number, v?: number) =>
    window.localStorage.setItem(KEY, JSON.stringify(v === undefined ? { choice, at } : { choice, at, v }));

  it('v2 granted on a Clarity store -> analytics + marketing granted, at kept', () => {
    const at = Date.now() - 1000 * 60 * 60 * 24 * 30;
    legacy('granted', at, 2);
    const r = readConsentRecord(SLUG, FULL);
    expect(r?.tracking).toEqual({ pv: CONSENT_PURPOSE_VERSION, at, analytics: true, marketing: true, vendors: ['clarity', 'ga4', 'meta'] });
    expect(trackingDecision(r, FULL)).toEqual({ analytics: true, marketing: true });
    // Persisted as schema 3 (localStorage + cookie).
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').schema).toBe(3);
    expect(cookieValue(COOKIE)).toMatch(/^3\./);
  });

  it('v1 granted on a Clarity store -> ask', () => {
    legacy('granted', Date.now());
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toBeNull();
  });

  it('v1 granted on a store without Clarity -> granted', () => {
    legacy('granted', Date.now());
    expect(trackingDecision(readConsentRecord(SLUG, NO_CLARITY), NO_CLARITY)).toEqual({ analytics: true, marketing: true });
  });

  it('denied -> denied', () => {
    legacy('denied', Date.now(), 2);
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toEqual({ analytics: false, marketing: false });
  });

  it('a legacy choice older than 12 months -> ask', () => {
    legacy('granted', Date.now() - CONSENT_MAX_AGE_MS - 1000, 2);
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toBeNull();
  });

  it('v1 denied on a Clarity store -> denied (a refusal is honoured whatever its version)', () => {
    legacy('denied', Date.now());
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toEqual({ analytics: false, marketing: false });
  });

  it('a cookie-only grant (no decision time, up to 365 days old) is asked again, never given a fresh 12 months', () => {
    document.cookie = `${COOKIE}=granted; path=/`;
    expect(trackingDecision(readConsentRecord(SLUG, NO_CLARITY), NO_CLARITY)).toBeNull();
    reset();
    document.cookie = `${COOKIE}=granted.2; path=/`;
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toBeNull();
    expect(logConsent).not.toHaveBeenCalled();
  });

  it('a cookie-only refusal is honoured (bare `denied` and `denied.1`, also on a Clarity store)', () => {
    document.cookie = `${COOKIE}=denied; path=/`;
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toEqual({ analytics: false, marketing: false });
    reset();
    document.cookie = `${COOKIE}=denied.1; path=/`;
    expect(trackingDecision(readConsentRecord(SLUG, NO_CLARITY), NO_CLARITY)).toEqual({ analytics: false, marketing: false });
  });

  it('cookie `denied.2` (storage blocked) migrates into the v3 cookie', () => {
    document.cookie = `${COOKIE}=denied.2; path=/`;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toEqual({ analytics: false, marketing: false });
    expect(cookieValue(COOKIE)).toMatch(/^3\./);
  });

  it('nothing valid to migrate (expired / stale grant) -> no record, no consent id, no log row', () => {
    legacy('granted', Date.now() - CONSENT_MAX_AGE_MS - 1000, 2);
    expect(readConsentRecord(SLUG, FULL)).toBeNull();
    expect(cookieValue(COOKIE)).toBeNull();
    expect(logConsent).not.toHaveBeenCalled();
    reset();
    legacy('granted', Date.now(), 1); // v1 grant on a Clarity store
    expect(readConsentRecord(SLUG, FULL)).toBeNull();
    expect(consentSnapshot(SLUG, FULL)).toBe('---||');
    expect(logConsent).not.toHaveBeenCalled();
  });

  it('a failed storage write (quota) never re-migrates: stable id, one log row, the cookie takes over', () => {
    legacy('granted', Date.now(), 2);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const a = consentSnapshot(SLUG, FULL);
    const b = consentSnapshot(SLUG, FULL);
    expect(a).toBe(b);
    expect(parseConsentSnapshot(a).tracking).toEqual({ analytics: true, marketing: true });
    expect(logConsent).toHaveBeenCalledTimes(1);
    // The legacy value was removed so it can never win over the v3 cookie.
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(cookieValue(COOKIE)).toMatch(/^3\./);
  });

  it('storage that can neither write nor remove keeps the migrated record in memory (no loop)', () => {
    legacy('granted', Date.now(), 2);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const a = consentSnapshot(SLUG, FULL);
    expect(consentSnapshot(SLUG, FULL)).toBe(a);
    expect(readConsentRecord(SLUG, FULL)?.id).toBe(parseConsentSnapshot(a).id);
    expect(logConsent).toHaveBeenCalledTimes(1);
  });

  it('M110 external grant in localStorage -> external granted, legacy keys deleted', () => {
    const at = Date.now() - 1000;
    window.localStorage.setItem(XKEY, JSON.stringify({ choice: 'granted', at, v: 1 }));
    document.cookie = `${XCOOKIE}=granted.1; path=/`;
    const r = readConsentRecord(SLUG, FULL);
    expect(r?.external).toEqual({ granted: true, at });
    expect(r?.tracking).toBeNull();
    expect(window.localStorage.getItem(XKEY)).toBeNull();
    expect(cookieValue(XCOOKIE)).toBeNull();
    expect(externalMediaAllowed(SLUG)).toBe(true);
  });

  it('M110 external grant only in the cookie (no decision time) -> not migrated, the facade asks again', () => {
    document.cookie = `${XCOOKIE}=granted.1; path=/`;
    expect(readConsentRecord(SLUG, FULL)).toBeNull();
    expect(externalMediaAllowed(SLUG)).toBe(false);
    expect(logConsent).not.toHaveBeenCalled();
  });

  it('grantExternalMediaConsent stores at once and logs the facade text hash once it resolves', async () => {
    const hash = 'c'.repeat(64);
    grantExternalMediaConsent(SLUG, Promise.resolve(hash));
    expect(externalMediaAllowed(SLUG)).toBe(true);
    await vi.waitFor(() => expect(logConsent).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logConsent).mock.calls[0][2]).toMatchObject({ action: 'external_media_grant', source: 'facade', textHash: hash });
  });

  it('logs the migration exactly once', () => {
    legacy('granted', Date.now(), 2);
    readConsentRecord(SLUG, FULL);
    readConsentRecord(SLUG, FULL);
    consentSnapshot(SLUG, FULL);
    expect(logConsent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logConsent).mock.calls[0][2]).toMatchObject({ action: 'migrated', source: 'migration', textHash: 'legacy' });
  });

  it('nothing legacy -> null and nothing written', () => {
    expect(readConsentRecord(SLUG, FULL)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(logConsent).not.toHaveBeenCalled();
  });

  it('MIGRATE_LEGACY_GRANTED=false -> a former grant asks again, a refusal is kept', () => {
    __setMigrateLegacyGrantedForTests(false);
    legacy('granted', Date.now(), 2);
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toBeNull();
    reset();
    __setMigrateLegacyGrantedForTests(false);
    legacy('denied', Date.now(), 2);
    expect(trackingDecision(readConsentRecord(SLUG, FULL), FULL)).toEqual({ analytics: false, marketing: false });
  });

  it('does not persist while the store trackers are unknown (slug-only read)', () => {
    window.localStorage.setItem(XKEY, JSON.stringify({ choice: 'granted', at: Date.now(), v: 1 }));
    expect(externalMediaAllowed('other-store')).toBe(false);
    const OTHER_XKEY = 'consent:other-store:external-media';
    window.localStorage.setItem(OTHER_XKEY, JSON.stringify({ choice: 'granted', at: Date.now(), v: 1 }));
    expect(externalMediaAllowed('other-store')).toBe(true);
    // Still legacy: the migration waits for the store's tracking config.
    expect(window.localStorage.getItem(OTHER_XKEY)).not.toBeNull();
    expect(logConsent).not.toHaveBeenCalled();
    window.localStorage.removeItem(OTHER_XKEY);
  });
});
