import { describe, expect, it } from 'vitest';
import {
  INITIAL_VAT_CHECK,
  normalizeVatCheckResponse,
  precheckVat,
  vatCheckKey,
  vatCheckMessageKey,
  vatCheckReducer,
  vatComparable,
  type VatCheckResult,
} from './vatCheck';

describe('vatComparable', () => {
  it('normalises and maps Greece GR → EL (VIES form)', () => {
    expect(vatComparable('gr 123.456.789')).toBe('EL123456789');
    expect(vatComparable('EL123456789')).toBe('EL123456789');
    expect(vatComparable('GR123456789')).toBe(vatComparable('el123456789'));
    expect(vatComparable('de 123 456 789')).toBe('DE123456789');
    expect(vatComparable(null)).toBe('');
    expect(vatComparable(undefined)).toBe('');
  });
});

const req = { vatNumber: 'DE123456789', countryCode: 'DE' };

describe('normalizeVatCheckResponse', () => {
  it('reads the §7 contract (valid + reverse charge)', () => {
    expect(
      normalizeVatCheckResponse(
        { vat_number: 'DE123456789', country_code: 'DE', status: 'valid', name: 'Muster GmbH', checked_at: '2026-10-15T09:12:00Z', reverse_charge: true, why: null },
        req,
      ),
    ).toEqual({
      state: 'valid', vatNumber: 'DE123456789', countryCode: 'DE', name: 'Muster GmbH',
      checkedAt: '2026-10-15T09:12:00Z', reverseCharge: true, why: null,
    });
  });

  it('keeps unavailable + why, drops the name of non-valid numbers', () => {
    const r = normalizeVatCheckResponse({ status: 'unavailable', name: 'X', reverse_charge: false, why: 'VAT_UNAVAILABLE' }, req);
    expect(r).toMatchObject({ state: 'unavailable', name: null, reverseCharge: false, why: 'VAT_UNAVAILABLE', vatNumber: 'DE123456789' });
  });

  it('returns null for disabled / malformed answers', () => {
    expect(normalizeVatCheckResponse({ status: 'disabled' }, req)).toBeNull();
    expect(normalizeVatCheckResponse(null, req)).toBeNull();
    // Unknown statuses fail closed as unavailable (VAT applies).
    expect(normalizeVatCheckResponse({ status: 'weird', error_code: 'QUEUE_TIMEOUT' }, req)?.state).toBe('unavailable');
    expect(normalizeVatCheckResponse({ status: 'unavailable', error_code: 'QUEUE_TIMEOUT' }, req)?.state).toBe('unavailable');
  });

  it('ignores unknown why codes and non-boolean reverse_charge', () => {
    expect(normalizeVatCheckResponse({ status: 'valid', why: 'NOPE', reverse_charge: 'yes' }, req)).toMatchObject({ why: null, reverseCharge: null });
  });
});

describe('precheckVat', () => {
  it('normalises and classifies', () => {
    expect(precheckVat('  ')).toEqual({ kind: 'empty' });
    expect(precheckVat('de 123.456-789')).toEqual({ kind: 'ok', vatNumber: 'DE123456789' });
    expect(precheckVat('DE12')).toEqual({ kind: 'format_invalid', vatNumber: 'DE12' });
  });
});

describe('vatCheckReducer', () => {
  const key = vatCheckKey('de123456789', 'de');
  const valid: VatCheckResult = {
    state: 'valid', vatNumber: 'DE123456789', countryCode: 'DE', name: 'Muster GmbH',
    checkedAt: null, reverseCharge: true, why: null,
  };

  it('builds the key from the normalised number + destination', () => {
    expect(key).toBe('DE123456789|DE');
    expect(vatCheckKey('DE123456789', null)).toBe('DE123456789|');
  });

  it('start → result settles the state', () => {
    const checking = vatCheckReducer(INITIAL_VAT_CHECK, { type: 'start', key });
    expect(checking).toEqual({ key, state: 'checking', result: null });
    expect(vatCheckReducer(checking, { type: 'result', key, result: valid })).toEqual({ key, state: 'valid', result: valid });
  });

  it('drops a stale result for an older key', () => {
    const checking = vatCheckReducer(INITIAL_VAT_CHECK, { type: 'start', key: 'NEW|DE' });
    expect(vatCheckReducer(checking, { type: 'result', key, result: valid })).toBe(checking);
    expect(vatCheckReducer(checking, { type: 'failed', key, vatNumber: 'DE123456789', countryCode: 'DE' })).toBe(checking);
  });

  it('a null result (reverse charge off) goes back to idle', () => {
    const checking = vatCheckReducer(INITIAL_VAT_CHECK, { type: 'start', key });
    expect(vatCheckReducer(checking, { type: 'result', key, result: null })).toEqual({ key, state: 'idle', result: null });
  });

  it('a failed request is fail-closed: unavailable, VAT applies', () => {
    const checking = vatCheckReducer(INITIAL_VAT_CHECK, { type: 'start', key });
    const failed = vatCheckReducer(checking, { type: 'failed', key, vatNumber: 'DE123456789', countryCode: 'DE' });
    expect(failed.state).toBe('unavailable');
    expect(failed.result).toMatchObject({ reverseCharge: false, why: 'VAT_UNAVAILABLE' });
  });

  it('format_invalid and reset', () => {
    const bad = vatCheckReducer(INITIAL_VAT_CHECK, { type: 'format_invalid', key: 'DE1|', vatNumber: 'DE1', countryCode: null });
    expect(bad.state).toBe('format_invalid');
    expect(bad.result).toMatchObject({ reverseCharge: null, why: 'VAT_INVALID' });
    expect(vatCheckReducer(bad, { type: 'reset' })).toBe(INITIAL_VAT_CHECK);
  });
});

describe('vatCheckMessageKey', () => {
  it('maps every state to its key and tone', () => {
    expect(vatCheckMessageKey('idle', null, null)).toBeNull();
    expect(vatCheckMessageKey('checking', null, null)).toEqual({ key: 'b2b.vat.checking', tone: 'muted' });
    expect(vatCheckMessageKey('valid', true, null)).toEqual({ key: 'b2b.vat.reverseCharge', tone: 'success' });
    expect(vatCheckMessageKey('valid', null, null)).toEqual({ key: 'b2b.vat.valid', tone: 'neutral' });
    expect(vatCheckMessageKey('invalid', false, 'VAT_INVALID')).toEqual({ key: 'b2b.vat.invalid', tone: 'error' });
    expect(vatCheckMessageKey('format_invalid', null, null)).toEqual({ key: 'b2b.vat.formatInvalid', tone: 'error' });
    expect(vatCheckMessageKey('not_eu', false, null)).toEqual({ key: 'b2b.vat.notEu', tone: 'neutral' });
    expect(vatCheckMessageKey('unavailable', false, 'VAT_UNAVAILABLE')).toEqual({ key: 'b2b.vat.unavailable', tone: 'warning' });
  });

  it('valid without reverse charge explains why (SE→SE etc.)', () => {
    expect(vatCheckMessageKey('valid', false, 'SAME_COUNTRY')).toEqual({ key: 'b2b.vat.validNoReverseCharge.SAME_COUNTRY', tone: 'neutral' });
    expect(vatCheckMessageKey('valid', false, 'DESTINATION_NOT_EU')?.key).toBe('b2b.vat.validNoReverseCharge.DESTINATION_NOT_EU');
    expect(vatCheckMessageKey('valid', false, 'VAT_COUNTRY_IS_SELLER')?.key).toBe('b2b.vat.validNoReverseCharge.VAT_COUNTRY_IS_SELLER');
    expect(vatCheckMessageKey('valid', false, 'MARKETPLACE')?.key).toBe('b2b.vat.validNoReverseCharge.DEFAULT');
    // API extension: a quote without destination decides nothing.
    expect(vatCheckMessageKey('valid', false, 'NO_DESTINATION')).toEqual({ key: 'b2b.vat.valid', tone: 'neutral' });
  });
});
