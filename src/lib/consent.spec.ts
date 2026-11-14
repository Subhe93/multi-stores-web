// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_VERSION,
  LEGACY_CONSENT_VERSION,
  requiredConsentVersion,
  subscribeConsent,
  consentCookieName,
  consentStorageKey,
  getActiveTrackers,
  hasTrackingIds,
  readConsent,
  setActiveTrackers,
  setClarityActive,
  writeConsent,
  clearConsent,
  clearExternalMediaConsent,
  externalMediaCookieName,
  externalMediaStorageKey,
  grantExternalMediaConsent,
  readExternalMediaConsent,
} from './consent';

// Consent version (plans/clarity/PLAN.md section 9.1): a choice saved under
// another version counts as "no choice", so the banner asks again.

const SLUG = 'namez-se';
const COOKIE = consentCookieName(SLUG);

function reset() {
  window.localStorage.clear();
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

describe('consent versioning', () => {
  beforeEach(reset);
  afterEach(reset);

  it('reads back a choice written under the current version', () => {
    writeConsent(SLUG, 'denied');
    expect(readConsent(SLUG)).toBe('denied');
    expect(JSON.parse(window.localStorage.getItem(consentStorageKey(SLUG)) ?? '{}').v).toBe(CONSENT_VERSION);
  });

  it('treats a legacy localStorage entry (no version) as no choice', () => {
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    expect(readConsent(SLUG)).toBeNull();
  });

  it('treats an older version as no choice', () => {
    window.localStorage.setItem(
      consentStorageKey(SLUG),
      JSON.stringify({ choice: 'granted', at: Date.now(), v: CONSENT_VERSION - 1 }),
    );
    expect(readConsent(SLUG)).toBeNull();
  });

  it('treats a legacy bare cookie value as no choice', () => {
    document.cookie = `${COOKIE}=granted; path=/`;
    expect(readConsent(SLUG)).toBeNull();
  });

  it('falls back to a current-version cookie when storage is empty', () => {
    document.cookie = `${COOKIE}=granted.${CONSENT_VERSION}; path=/`;
    expect(readConsent(SLUG)).toBe('granted');
  });

  // Only a Clarity store re-asks: the purposes did not change elsewhere, so
  // a v1 choice (Namez's returning visitors) keeps GA4 / Meta running.
  it('a store without Clarity honours v1 choices (no v, bare cookie)', () => {
    const v1 = requiredConsentVersion({ clarity_project_id: null });
    expect(v1).toBe(LEGACY_CONSENT_VERSION);
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    expect(readConsent(SLUG, v1)).toBe('granted');
    window.localStorage.clear();
    document.cookie = `${COOKIE}=denied; path=/`;
    expect(readConsent(SLUG, v1)).toBe('denied');
    // A v2 choice satisfies a v1 store too.
    writeConsent(SLUG, 'granted');
    expect(readConsent(SLUG, v1)).toBe('granted');
  });

  it('a Clarity store requires the current version', () => {
    const v2 = requiredConsentVersion({ clarity_project_id: 'sxtuobatm6' });
    expect(v2).toBe(CONSENT_VERSION);
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    document.cookie = `${COOKIE}=granted; path=/`;
    expect(readConsent(SLUG, v2)).toBeNull();
  });
});

describe('subscribeConsent', () => {
  it('fires for another tab changing a consent key (storage event), not for other keys', () => {
    const onChange = vi.fn();
    const off = subscribeConsent(onChange);
    window.dispatchEvent(new StorageEvent('storage', { key: consentStorageKey(SLUG) }));
    expect(onChange).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ms_coupon:s1' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: consentStorageKey(SLUG) }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('tracking ids', () => {
  it('counts a Clarity project id as a tracker (banner shows)', () => {
    expect(hasTrackingIds({ clarity_project_id: 'sxtuobatm6' })).toBe(true);
    expect(hasTrackingIds({ clarity_project_id: null })).toBe(false);
  });

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

describe('external media consent (CONTRACT-AUTOPLAY 6.1)', () => {
  const XCOOKIE = externalMediaCookieName(SLUG);
  function resetAll() {
    reset();
    document.cookie = `${XCOOKIE}=; path=/; max-age=0`;
  }
  beforeEach(resetAll);
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetAll();
  });

  it('uses a "consent:" storage key and a cookie that never collides with consent_<slug>', () => {
    expect(externalMediaStorageKey(SLUG)).toBe('consent:namez-se:external-media');
    expect(externalMediaCookieName(SLUG)).toBe('xmedia_namez-se');
  });

  it('grant / read / clear', () => {
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    grantExternalMediaConsent(SLUG);
    expect(readExternalMediaConsent(SLUG)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(externalMediaStorageKey(SLUG)) ?? '{}')).toMatchObject({
      choice: 'granted',
      v: 1,
    });
    expect(document.cookie).toContain(`${XCOOKIE}=granted.1`);
    clearExternalMediaConsent(SLUG);
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    expect(document.cookie).not.toContain(`${XCOOKIE}=`);
  });

  it('expires after one year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    grantExternalMediaConsent(SLUG);
    vi.setSystemTime(new Date('2026-12-31T00:00:00Z'));
    expect(readExternalMediaConsent(SLUG)).toBe(true);
    vi.setSystemTime(new Date('2027-01-02T00:00:00Z'));
    expect(readExternalMediaConsent(SLUG)).toBe(false);
  });

  it('falls back to the cookie when storage throws', () => {
    grantExternalMediaConsent(SLUG);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readExternalMediaConsent(SLUG)).toBe(true);
  });

  it('the tracking choice and the external grant are independent', () => {
    writeConsent(SLUG, 'granted');
    expect(readExternalMediaConsent(SLUG)).toBe(false);
    grantExternalMediaConsent(SLUG);
    clearConsent(SLUG);
    expect(readExternalMediaConsent(SLUG)).toBe(true);
    writeConsent(SLUG, 'denied');
    clearExternalMediaConsent(SLUG);
    expect(readConsent(SLUG)).toBe('denied');
  });

  it('notifies subscribers on grant and clear', () => {
    const cb = vi.fn();
    const off = subscribeConsent(cb);
    grantExternalMediaConsent(SLUG);
    clearExternalMediaConsent(SLUG);
    off();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('is false and a no-op without a store slug', () => {
    grantExternalMediaConsent('');
    expect(readExternalMediaConsent('')).toBe(false);
  });
});
