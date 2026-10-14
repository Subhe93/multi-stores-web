import { describe, expect, it } from 'vitest';
import { deriveNetTotals, normalizeB2bNetTotals } from './tax';

describe('deriveNetTotals', () => {
  it('INCLUSIVE: net total = total − tax, shipping net of its own tax', () => {
    expect(deriveNetTotals({ total: 174, tax_amount: 34.8, shipping_cost: 49, shipping_tax_amount: 9.8, tax_pricing_mode: 'INCLUSIVE' }))
      .toEqual({ display_mode: 'excl', net_items: 100, net_shipping: 39.2, net_total: 139.2 });
  });

  it('EXCLUSIVE: shipping is already net', () => {
    expect(deriveNetTotals({ total: 174, tax_amount: 34.8, shipping_cost: 39.2, tax_pricing_mode: 'EXCLUSIVE' }))
      .toEqual({ display_mode: 'excl', net_items: 100, net_shipping: 39.2, net_total: 139.2 });
  });

  it('falls back to the tax lines when tax_amount is missing, and never goes negative', () => {
    expect(deriveNetTotals({ total: '125', tax_lines: [{ label: 'Moms', rate_bp: 2500, taxable_amount: 100, tax_amount: 25 }], shipping_cost: '0' }))
      .toEqual({ display_mode: 'excl', net_items: 100, net_shipping: 0, net_total: 100 });
    expect(deriveNetTotals({ total: 10, tax_amount: 20, shipping_cost: 5 }))
      .toEqual({ display_mode: 'excl', net_items: 0, net_shipping: 5, net_total: 0 });
    expect(deriveNetTotals({})).toEqual({ display_mode: 'excl', net_items: 0, net_shipping: 0, net_total: 0 });
  });
});

describe('normalizeB2bNetTotals', () => {
  it('coerces the API block and tolerates camelCase / strings', () => {
    expect(normalizeB2bNetTotals({ display_mode: 'excl', net_items: '100.00', net_shipping: 39.2, net_total: 139.2 }))
      .toEqual({ display_mode: 'excl', net_items: 100, net_shipping: 39.2, net_total: 139.2 });
    expect(normalizeB2bNetTotals({ netItems: 100, netShipping: 0 }))
      .toEqual({ display_mode: 'incl', net_items: 100, net_shipping: 0, net_total: 100 });
  });

  it('returns null when the block is absent', () => {
    expect(normalizeB2bNetTotals(undefined)).toBeNull();
    expect(normalizeB2bNetTotals(null)).toBeNull();
    expect(normalizeB2bNetTotals({})).toBeNull();
  });
});
