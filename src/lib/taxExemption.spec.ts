import { describe, expect, it } from 'vitest';
import { netFromGross } from './b2bPrice';
import { normalizeTaxLines } from './tax';
import { exemptLinePrices, normalizeQuoteTaxExemption, summaryUnitAmounts } from './taxExemption';

// Company display of a taxed price at 25 % (what useDisplayPrice does).
const companyDisplay = (amount: number) => netFromGross(amount, 2500, 'SEK');

describe('exemptLinePrices', () => {
  const cart = [
    { id: 'a', productId: 'p1', variantId: 'v1' },
    { id: 'b', productId: 'p1', variantId: 'v1' },
    { id: 'c', productId: 'cp1', customProductId: 'cp1' },
    { id: 'd', productId: 'p9' },
  ];
  const quoteItems = [
    { product_id: 'p1', variant_id: 'v1', unit_price: 100, original_unit_price: null },
    { custom_product_id: 'cp1', product_id: 'base', unit_price: '40.00', original_unit_price: '48' },
    { product_id: 'p1', variant_id: 'v1', unit_price: 80 },
  ];

  it('matches by identity, in order for repeated lines', () => {
    expect(exemptLinePrices(quoteItems, cart)).toEqual({
      a: { unit: 100, original: null },
      b: { unit: 80, original: null },
      c: { unit: 40, original: 48 },
    });
  });

  it('is empty for a missing items array', () => {
    expect(exemptLinePrices(undefined, cart)).toEqual({});
  });
});

describe('summaryUnitAmounts (M2.5 §10 item 9: no double netting)', () => {
  const base = { itemId: 'a', price: 125, originalPrice: null, pricing: 'net' as const, display: companyDisplay, net: companyDisplay };

  it('exempt quote price is shown as-is, never re-netted', () => {
    const r = summaryUnitAmounts({ ...base, exemptReason: 'REVERSE_CHARGE', exemptPrices: { a: { unit: 100, original: null } } });
    expect(r.unit).toBe(100);
    // Re-netting would have produced 80.
    expect(r.unit).not.toBe(companyDisplay(100));
  });

  it('gross pricing without line prices keeps the unchanged cart price', () => {
    expect(summaryUnitAmounts({ ...base, pricing: 'gross', exemptReason: 'REVERSE_CHARGE', exemptPrices: null }).unit).toBe(125);
  });

  it('net pricing without line prices uses the company estimate (same as the API net)', () => {
    expect(summaryUnitAmounts({ ...base, exemptReason: 'REVERSE_CHARGE', exemptPrices: {} }).unit).toBe(100);
  });

  it('FULL-exempt person on INCLUSIVE + net without line data: nets the line (not the gross display)', () => {
    const personDisplay = (n: number) => n;
    const r = summaryUnitAmounts({ ...base, display: personDisplay, exemptReason: 'CUSTOMER_EXEMPT', exemptPrices: null, originalPrice: 150 });
    expect(r).toEqual({ unit: 100, original: 120 });
  });

  it('session per-line amounts win over any derivation', () => {
    const personDisplay = (n: number) => n;
    const r = summaryUnitAmounts({ ...base, display: personDisplay, exemptReason: 'CUSTOMER_EXEMPT', exemptPrices: { a: { unit: 99.5, original: null } } });
    expect(r.unit).toBe(99.5);
  });

  it('taxed quote: the regular display (person path unchanged)', () => {
    const identity = (n: number) => n;
    expect(summaryUnitAmounts({ ...base, display: identity, exemptReason: null, exemptPrices: null, originalPrice: 150 })).toEqual({ unit: 125, original: 150 });
    expect(summaryUnitAmounts({ ...base, exemptReason: null, exemptPrices: { a: { unit: 1, original: null } } }).unit).toBe(100);
  });
});

describe('normalizeQuoteTaxExemption', () => {
  it('reads the §7 block', () => {
    expect(
      normalizeQuoteTaxExemption({ reason: 'REVERSE_CHARGE', vat_number: 'DE123456789', name: 'Muster GmbH', checked_at: '2026-10-15T09:12:00Z', why: null }),
    ).toEqual({ reason: 'REVERSE_CHARGE', vat_number: 'DE123456789', name: 'Muster GmbH', checked_at: '2026-10-15T09:12:00Z', why: null });
    expect(normalizeQuoteTaxExemption({ reason: null, why: 'SAME_COUNTRY' })).toMatchObject({ reason: null, why: 'SAME_COUNTRY' });
    expect(normalizeQuoteTaxExemption(undefined)).toBeNull();
  });
});

describe('normalizeTaxLines exempt_reason', () => {
  it('keeps exempt_reason only on the exempt row', () => {
    const lines = normalizeTaxLines([
      { label: 'Reverse charge', rate_bp: 0, taxable_amount: 139.2, tax_amount: 0, exempt_reason: 'REVERSE_CHARGE' },
      { label: 'Moms', rate_bp: 2500, taxable_amount: 100, tax_amount: 25 },
    ]);
    expect(lines[0]).toEqual({ label: 'Reverse charge', rate_bp: 0, taxable_amount: 139.2, tax_amount: 0, exempt_reason: 'REVERSE_CHARGE' });
    expect(lines[1]).toStrictEqual({ label: 'Moms', rate_bp: 2500, taxable_amount: 100, tax_amount: 25 });
  });
});
