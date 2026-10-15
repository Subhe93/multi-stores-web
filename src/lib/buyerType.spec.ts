import { describe, expect, it } from 'vitest';
import {
  BUYER_COOKIE,
  buyerCookieString,
  parseBuyerType,
  readBuyerCookie,
  resolveInitialBuyerType,
  toApiBuyerType,
} from './buyerType';
import { DEFAULT_B2B_SETTINGS, normalizeB2bSettings } from './b2bSettings';

describe('parseBuyerType', () => {
  it('accepts the two known values, case-insensitively', () => {
    expect(parseBuyerType('person')).toBe('person');
    expect(parseBuyerType('company')).toBe('company');
    expect(parseBuyerType(' Company ')).toBe('company');
  });

  it('rejects anything else', () => {
    expect(parseBuyerType('')).toBeNull();
    expect(parseBuyerType('business')).toBeNull();
    expect(parseBuyerType(undefined)).toBeNull();
    expect(parseBuyerType(null)).toBeNull();
    expect(parseBuyerType(42)).toBeNull();
  });
});

describe('resolveInitialBuyerType', () => {
  it('defaults to person without a cookie or settings', () => {
    expect(resolveInitialBuyerType({})).toBe('person');
    expect(resolveInitialBuyerType({ cookie: null, settings: null })).toBe('person');
  });

  it('lets the cookie win over the default buyer type', () => {
    expect(resolveInitialBuyerType({ cookie: 'company', settings: DEFAULT_B2B_SETTINGS })).toBe('company');
    expect(
      resolveInitialBuyerType({ cookie: 'person', settings: { ...DEFAULT_B2B_SETTINGS, default_buyer_type: 'COMPANY' } }),
    ).toBe('person');
  });

  it('falls back to the settings default when the cookie is missing or malformed', () => {
    expect(resolveInitialBuyerType({ settings: { ...DEFAULT_B2B_SETTINGS, default_buyer_type: 'COMPANY' } })).toBe('company');
    expect(
      resolveInitialBuyerType({ cookie: 'garbage', settings: { ...DEFAULT_B2B_SETTINGS, default_buyer_type: 'COMPANY' } }),
    ).toBe('company');
  });

  it('never returns company when allow_company is false', () => {
    const settings = { ...DEFAULT_B2B_SETTINGS, allow_company: false, default_buyer_type: 'COMPANY' as const };
    expect(resolveInitialBuyerType({ cookie: 'company', settings })).toBe('person');
    expect(resolveInitialBuyerType({ settings })).toBe('person');
  });
});

describe('cookie helpers', () => {
  it('writes a one-year, site-wide, lax cookie', () => {
    expect(buyerCookieString('company')).toBe(`${BUYER_COOKIE}=company; Path=/; Max-Age=31536000; SameSite=Lax`);
  });

  it('reads the cookie out of a document.cookie string', () => {
    expect(readBuyerCookie('a=1; ms-buyer-type=company; b=2')).toBe('company');
    expect(readBuyerCookie('ms-buyer-type=nope')).toBeNull();
    expect(readBuyerCookie('')).toBeNull();
    expect(readBuyerCookie(undefined)).toBeNull();
  });

  it('maps to the API spelling', () => {
    expect(toApiBuyerType('company')).toBe('COMPANY');
    expect(toApiBuyerType('person')).toBe('PERSON');
  });
});

describe('normalizeB2bSettings', () => {
  it('returns the defaults for a missing / malformed block', () => {
    expect(normalizeB2bSettings(undefined)).toEqual(DEFAULT_B2B_SETTINGS);
    expect(normalizeB2bSettings('x')).toEqual(DEFAULT_B2B_SETTINGS);
    expect(normalizeB2bSettings([])).toEqual(DEFAULT_B2B_SETTINGS);
  });

  it('coerces each field and falls back per field', () => {
    expect(
      normalizeB2bSettings({ allow_company: false, default_buyer_type: 'COMPANY', require_vat_number: true, org_number_countries: ['se', ' fi ', 'xyz', 3] }),
    ).toEqual({
      allow_company: false, default_buyer_type: 'COMPANY', require_vat_number: true, org_number_countries: ['SE', 'FI'],
      reverse_charge_enabled: false, reverse_charge_pricing: 'net',
    });
    expect(normalizeB2bSettings({ default_buyer_type: 'other', org_number_countries: 'SE' })).toEqual(DEFAULT_B2B_SETTINGS);
  });

  it('reads the reverse-charge settings (M2.5): strict true, pricing net unless gross', () => {
    expect(normalizeB2bSettings({ reverse_charge_enabled: true, reverse_charge_pricing: 'gross' })).toMatchObject({
      reverse_charge_enabled: true, reverse_charge_pricing: 'gross',
    });
    expect(normalizeB2bSettings({ reverse_charge_enabled: 'yes', reverse_charge_pricing: 'other' })).toMatchObject({
      reverse_charge_enabled: false, reverse_charge_pricing: 'net',
    });
  });
});
