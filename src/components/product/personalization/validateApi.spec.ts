import { describe, expect, it } from 'vitest';
import { addGuestLine } from '@/lib/guestCart';
import { computeBundlePricing } from '@/lib/bundle';
import { readApiPersonalizationErrors } from './model';
import {
  applyValidateResult,
  buildValidateBody,
  personalizationInvalidError,
  readValidateResult,
  validatePath,
} from './validateApi';

const check = { storeSlug: 'namez', locale: 'sv', market: 'se' };

describe('validate request', () => {
  it('builds the §4.5 body and path', () => {
    expect(validatePath('na mez')).toBe('/storefront/na%20mez/personalization/validate');
    expect(buildValidateBody('p1', 'v1', 2, { n1: 'KARIN' }, check)).toEqual({
      product_id: 'p1',
      variant_id: 'v1',
      custom_fields: { n1: 'KARIN' },
      locale: 'sv',
      market: 'se',
      quantity: 2,
    });
    expect(buildValidateBody('p1', null, 1, undefined, { storeSlug: 's', locale: 'en' })).toMatchObject({
      variant_id: null,
      custom_fields: {},
      market: null,
    });
  });
});

describe('validate result', () => {
  const ok = {
    ok: true,
    errors: [],
    custom_fields: { lead: 'ÅSA', rep: [{ 'c-name': 'KARIN' }] },
    price_delta: 0,
    unit_price: 499,
    currency: 'SEK',
    display: [
      { id: 'lead#1', label: 'Namn', value: 'ÅSA', display: null, group_key: 'dnc_items', group_index: 1, group_label: 'Artikel 1', source: 'FIELD' },
      { id: 'option:Färg#1', label: 'Färg', value: 'Röd', group_index: 1, hex: '#dd3333', source: 'OPTION', extra: 'dropped' },
      { label: 3 },
    ],
  };

  it('reads a successful result leniently', () => {
    const r = readValidateResult(ok)!;
    expect(r.ok).toBe(true);
    expect(r.unit_price).toBe(499);
    expect(r.custom_fields).toEqual(ok.custom_fields);
    expect(r.display).toEqual([
      { id: 'lead#1', label: 'Namn', value: 'ÅSA', display: null, group_key: 'dnc_items', group_index: 1, group_label: 'Artikel 1', source: 'FIELD' },
      { id: 'option:Färg#1', label: 'Färg', value: 'Röd', display: null, group_index: 1, hex: '#dd3333', source: 'OPTION' },
    ]);
  });

  it('reads a rejection and turns it into the API error shape', () => {
    const r = readValidateResult({
      ok: false,
      errors: [{ code: 'CUSTOM_FIELD_LENGTH_MISMATCH', field_id: 'n2', field_name: 'name_2', message: 'Längderna stämmer inte överens!' }],
    })!;
    expect(r.ok).toBe(false);
    const err = personalizationInvalidError(r.errors);
    expect(err.code).toBe('PERSONALIZATION_INVALID');
    expect(readApiPersonalizationErrors(err)).toEqual(r.errors);
  });

  it('refuses a non-result body', () => {
    expect(readValidateResult(null)).toBeNull();
    expect(readValidateResult({ custom_fields: {} })).toBeNull();
    // ok:true with errors is not ok.
    expect(readValidateResult({ ok: true, errors: [{ code: 'CUSTOM_FIELD_REQUIRED', field_id: 'x' }] })?.ok).toBe(false);
  });
});

describe('guest line after the check', () => {
  it('stores the server unit price and display, never the client price', () => {
    const r = readValidateResult({ ...{ ok: true, errors: [], custom_fields: { n1: 'KARIN' }, unit_price: 349, display: [] } })!;
    const meta = applyValidateResult({ title: 'Nyckelring', price: 299, personalizationCheck: check }, r);
    expect(meta).toEqual({ title: 'Nyckelring', price: 349, customFieldDisplay: [] });
    const cart = addGuestLine([], 'p1', 'v1', 1, r.custom_fields, meta, () => 'l1');
    expect(cart[0]).toMatchObject({ price: 349, customFields: { n1: 'KARIN' } });
    expect(cart[0]).not.toHaveProperty('personalizationCheck');
  });

  it('applies the selected bundle to the server unit price', () => {
    const offer = { quantity: 2, discount_type: 'PERCENTAGE' as const, discount_value: 10 };
    const r = readValidateResult({ ok: true, errors: [], custom_fields: {}, unit_price: 500, display: [] })!;
    const meta = applyValidateResult(
      {
        price: 1,
        bundleOfferId: 'o1',
        bundleOriginalUnitPrice: 1,
        personalizationCheck: { ...check, linePrice: (u) => computeBundlePricing(u, offer).effectiveUnitPrice },
      },
      r,
    );
    expect(meta.price).toBe(computeBundlePricing(500, offer).effectiveUnitPrice);
    expect(meta.bundleOriginalUnitPrice).toBe(500);
  });

  it('keeps the metadata price when the server sent no unit price', () => {
    const r = readValidateResult({ ok: true, errors: [], custom_fields: {}, display: [] })!;
    expect(applyValidateResult({ price: 299, personalizationCheck: check }, r).price).toBe(299);
  });
});
