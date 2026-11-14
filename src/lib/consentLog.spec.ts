// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './api';
import { CONSENT_PURPOSE_VERSION, type ConsentRecord } from './consent';
import { consentLogPayload, consentText, consentTextHash, logConsent, normalizeConsentLocale, randomUuid } from './consentLog';

// Consent log client (plans/consent-v2/CONTRACT.md §5.1).

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REC: ConsentRecord = {
  schema: 3,
  id: '6f1c1f0e-3a5b-4c1d-9e2f-0a1b2c3d4e5f',
  tracking: {
    pv: CONSENT_PURPOSE_VERSION,
    at: 1_763_000_000_000,
    analytics: true,
    marketing: false,
    vendors: ['clarity', 'ga4', 'meta'],
  },
  external: { granted: true, at: 1_763_000_000_000 },
};
const TRACKING = { ga4_measurement_id: 'G-1', clarity_project_id: 'abc', meta_pixel_id: '1' };
const META = { action: 'save' as const, source: 'dialog' as const, textHash: 'a'.repeat(64), locale: 'sv' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('consentLogPayload', () => {
  it('has the API shape (§5.2)', () => {
    const p = consentLogPayload(REC, META, TRACKING);
    expect(p).toEqual({
      event_id: expect.stringMatching(UUID_V4),
      consent_id: REC.id,
      action: 'save',
      source: 'dialog',
      analytics: true,
      marketing: false,
      external_media: true,
      consent_version: String(CONSENT_PURPOSE_VERSION),
      vendors: ['clarity', 'ga4', 'meta'],
      text_hash: 'a'.repeat(64),
      locale: 'sv',
    });
  });

  it('null for categories not offered or not decided', () => {
    const p = consentLogPayload({ ...REC, tracking: null, external: null }, META, null);
    expect(p).toMatchObject({ analytics: null, marketing: null, external_media: null, vendors: [] });
    const q = consentLogPayload(REC, META, { ga4_measurement_id: 'G-1' });
    expect(q).toMatchObject({ analytics: true, marketing: null });
  });

  it('sanitises an unknown text hash and the locale', () => {
    expect(consentLogPayload(REC, { ...META, textHash: 'oops' }, TRACKING).text_hash).toBe('unavailable');
    expect(consentLogPayload(REC, { ...META, textHash: 'legacy' }, TRACKING).text_hash).toBe('legacy');
    expect(normalizeConsentLocale('sv-se')).toBe('sv-SE');
    expect(normalizeConsentLocale('en_GB')).toBe('en-GB');
    expect(normalizeConsentLocale('AR')).toBe('ar');
    expect(normalizeConsentLocale('')).toBe('en');
  });

  it('randomUuid falls back without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => b.fill(7) });
    expect(randomUuid()).toMatch(UUID_V4);
  });
});

describe('logConsent', () => {
  it('POSTs with keepalive, without credentials', () => {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);
    logConsent('namez-se', REC, META, TRACKING);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/storefront/namez-se/consent`);
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body as string)).toMatchObject({ consent_id: REC.id, action: 'save' });
  });

  it('swallows a rejected fetch and a throwing fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect(() => logConsent('namez-se', REC, META, TRACKING)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('sync');
      }),
    );
    expect(() => logConsent('namez-se', REC, META, TRACKING)).not.toThrow();
  });
});

describe('consentTextHash', () => {
  function el(html: string): Element {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('reads only [data-consent-text] and collapses whitespace', () => {
    const root = el(
      '<h2 data-consent-text>  We use\n cookies </h2><span>id 1234</span><p data-consent-text>Body <b>text</b></p><button>Accept</button>',
    );
    expect(consentText(root)).toBe('We use cookies\nBody text');
  });

  it('does not double count nested markers', () => {
    expect(consentText(el('<div data-consent-text>A <span data-consent-text>B</span></div>'))).toBe('A B');
  });

  it('hashes the same text the same way, ignoring unmarked elements', async () => {
    const a = await consentTextHash(el('<p data-consent-text>Hej  då</p><span>x</span>'));
    const b = await consentTextHash(el('<p data-consent-text> Hej då </p><span>y</span>'));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
    expect(await consentTextHash(el('<p data-consent-text>Hej</p>'))).not.toBe(a);
  });

  it('is "unavailable" without crypto.subtle or a root', async () => {
    expect(await consentTextHash(null)).toBe('unavailable');
    vi.stubGlobal('crypto', {});
    expect(await consentTextHash(el('<p data-consent-text>x</p>'))).toBe('unavailable');
  });
});
