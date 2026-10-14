import { describe, expect, it } from 'vitest';
import {
  checkOrgNumber,
  luhnValid,
  normalizeOrgNumber,
  normalizeVatNumber,
  orgNumberFormatHint,
  validateCompanyName,
  validateOrgNumber,
  validateVatNumber,
} from './b2bValidators';

describe('validateOrgNumber (port of the API org-number.util)', () => {
  const NORDIC = ['SE', 'FI', 'DK', 'NO'];

  it('SE: valid with or without the hyphen, 12-digit form reduced, normalized to NNNNNN-NNNN', () => {
    expect(validateOrgNumber('SE', '556036-0793')).toBeNull();
    expect(validateOrgNumber('SE', '5560360793')).toBeNull();
    expect(validateOrgNumber('se', ' 556 016-0680 ')).toBeNull();
    expect(validateOrgNumber('SE', '165560360793')).toBeNull();
    expect(normalizeOrgNumber('SE', '5560360793')).toBe('556036-0793');
    expect(normalizeOrgNumber('se', '556036 0793')).toBe('556036-0793');
    expect(normalizeOrgNumber('SE', '165560360793')).toBe('556036-0793');
    expect(checkOrgNumber('SE', '556036-0793')).toEqual({ ok: true, normalized: '556036-0793', reason: null, format: 'NNNNNN-NNNN', country: 'SE' });
  });

  it('SE: Luhn failure, wrong length, letters and foreign separators are rejected', () => {
    expect(validateOrgNumber('SE', '559123-4567')).toEqual({ key: 'checkout.errors.orgNumberInvalid', format: 'NNNNNN-NNNN' });
    expect(checkOrgNumber('SE', '559123-4567')).toMatchObject({ ok: false, reason: 'CHECKSUM', normalized: '559123-4567' });
    expect(checkOrgNumber('SE', '55603')).toMatchObject({ ok: false, reason: 'FORMAT' });
    expect(checkOrgNumber('SE', 'HRB 12345')).toMatchObject({ ok: false, reason: 'FORMAT' });
    // Only whitespace, hyphen and dot are separators.
    expect(checkOrgNumber('SE', '5560360793x')).toMatchObject({ ok: false, reason: 'FORMAT' });
    expect(checkOrgNumber('SE', '556036/0793')).toMatchObject({ ok: false, reason: 'FORMAT' });
    expect(validateOrgNumber('SE', '556036.0793')).toBeNull();
  });

  it('empty is "required" with the expected format', () => {
    expect(validateOrgNumber('SE', '')).toEqual({ key: 'checkout.errors.orgNumberRequired' });
    expect(validateOrgNumber('DE', '   ')).toEqual({ key: 'checkout.errors.orgNumberRequired' });
    expect(checkOrgNumber('SE', '   ')).toEqual({ ok: false, normalized: '', reason: 'EMPTY', format: 'NNNNNN-NNNN', country: 'SE' });
    expect(checkOrgNumber('DE', null).reason).toBe('EMPTY');
  });

  it('FI: Y-tunnus with the mod-11 check digit', () => {
    expect(validateOrgNumber('FI', '0112038-9', NORDIC)).toBeNull();
    expect(normalizeOrgNumber('FI', '01120389', NORDIC)).toBe('0112038-9');
    expect(checkOrgNumber('FI', '0112038-8', NORDIC).reason).toBe('CHECKSUM');
    expect(validateOrgNumber('FI', '123456-8', NORDIC)).toEqual({ key: 'checkout.errors.orgNumberInvalid', format: 'NNNNNNN-N' });
  });

  it('DK: 8-digit CVR with mod-11 weights', () => {
    expect(validateOrgNumber('DK', '22 75 62 14', NORDIC)).toBeNull();
    expect(normalizeOrgNumber('DK', '22 75 62 14', NORDIC)).toBe('22756214');
    expect(checkOrgNumber('DK', '22756215', NORDIC).reason).toBe('CHECKSUM');
    expect(validateOrgNumber('DK', '1234567', NORDIC)?.format).toBe('NNNNNNNN');
  });

  it('NO: 9-digit organisasjonsnummer, trailing MVA ignored', () => {
    expect(validateOrgNumber('NO', '923 609 016', NORDIC)).toBeNull();
    expect(validateOrgNumber('NO', '923609016MVA', NORDIC)).toBeNull();
    expect(normalizeOrgNumber('NO', '923609016MVA', NORDIC)).toBe('923609016');
    expect(checkOrgNumber('NO', '923609017', NORDIC).reason).toBe('CHECKSUM');
    expect(validateOrgNumber('NO', '92360901', NORDIC)?.format).toBe('NNNNNNNNN');
  });

  it('generic rule accepts "HRB 12345" / "12-3456789" and rejects garbage', () => {
    expect(validateOrgNumber('DE', 'HRB 12345')).toBeNull();
    expect(checkOrgNumber('DE', 'HRB 12345')).toEqual({ ok: true, normalized: 'HRB 12345', reason: null, format: '4-20 characters', country: null });
    expect(normalizeOrgNumber('DE', '  HRB   12345 ')).toBe('HRB 12345');
    expect(validateOrgNumber('US', '12-3456789')).toBeNull();
    expect(validateOrgNumber('DE', 'AB1')).toEqual({ key: 'checkout.errors.orgNumberInvalid', format: '4-20 characters' });
    expect(validateOrgNumber('DE', '1'.repeat(21))?.format).toBe('4-20 characters');
    expect(validateOrgNumber('DE', 'HRB#12345')?.format).toBe('4-20 characters');
    expect(validateOrgNumber(undefined, 'HRB 12345')).toBeNull();
  });

  it('a country with a rule that is not in the strict list uses the generic rule (L7)', () => {
    expect(validateOrgNumber('SE', '559123-4567', ['FI'])).toBeNull();
    expect(checkOrgNumber('SE', '559123-4567', ['FI'])).toMatchObject({ ok: true, normalized: '559123-4567', country: null });
    expect(checkOrgNumber('DE', 'HRB 12345', ['DE'])).toMatchObject({ ok: true, country: null });
    expect(orgNumberFormatHint('SE')).toBe('NNNNNN-NNNN');
    expect(orgNumberFormatHint('SE', [])).toBe('4-20 characters');
    expect(orgNumberFormatHint('DE')).toBe('4-20 characters');
  });

  it('normalizeOrgNumber keeps the input when it does not validate', () => {
    expect(normalizeOrgNumber('SE', '559123-4567')).toBe('559123-4567');
    expect(normalizeOrgNumber(null, ' HRB  1 ')).toBe('HRB 1');
    expect(normalizeOrgNumber('DE', '')).toBe('');
  });

  it('luhnValid', () => {
    expect(luhnValid('5560360793')).toBe(true);
    expect(luhnValid('5591234567')).toBe(false);
    expect(luhnValid('55x0360793')).toBe(false);
  });
});

describe('validateCompanyName', () => {
  it('requires a non-blank name of at most 200 characters', () => {
    expect(validateCompanyName('Neronet Academy AB')).toBeNull();
    expect(validateCompanyName('   ')).toBe('checkout.errors.companyNameRequired');
    expect(validateCompanyName('x'.repeat(201))).toBe('checkout.errors.companyNameRequired');
  });
});

describe('validateVatNumber', () => {
  it('accepts known prefixes and normalises case / spaces', () => {
    expect(validateVatNumber('SE556677889901')).toBeNull();
    expect(validateVatNumber('se 5566 7788 9901')).toBeNull();
    expect(normalizeVatNumber('se 5566-7788.9901')).toBe('SE556677889901');
    expect(validateVatNumber('DE123456789')).toBeNull();
    expect(validateVatNumber('NO999999999MVA')).toBeNull();
    expect(validateVatNumber('GB123456789')).toBeNull();
    expect(validateVatNumber('GB123456789012')).toBeNull();
    expect(validateVatNumber('NL123456789B01')).toBeNull();
    expect(validateVatNumber('ATU12345678')).toBeNull();
    expect(validateVatNumber('FI12345678')).toBeNull();
  });

  it('rejects wrong lengths for a known prefix', () => {
    expect(validateVatNumber('SE5566778899')).toBe('checkout.errors.vatNumberInvalid');
    expect(validateVatNumber('DE12345678')).toBe('checkout.errors.vatNumberInvalid');
    expect(validateVatNumber('GB12345')).toBe('checkout.errors.vatNumberInvalid');
  });

  it('unknown prefix falls back to the generic rule; garbage is rejected', () => {
    expect(validateVatNumber('XX12345')).toBeNull();
    expect(validateVatNumber('X1')).toBe('checkout.errors.vatNumberInvalid');
    expect(validateVatNumber('12345678')).toBe('checkout.errors.vatNumberInvalid');
    expect(validateVatNumber('SE55667788990123456')).toBe('checkout.errors.vatNumberInvalid');
  });

  it('empty is fine unless required', () => {
    expect(validateVatNumber('')).toBeNull();
    expect(validateVatNumber('  ', false)).toBeNull();
    expect(validateVatNumber('', true)).toBe('checkout.errors.vatNumberRequired');
  });
});
