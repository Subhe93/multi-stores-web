import { describe, expect, it } from 'vitest';
import { normalizeKustomTotals } from './useKustomCheckout';

// M97: the summary shows "Fri frakt" only when the API says shipping was
// priced for a destination; the normaliser must carry that flag through.
describe('normalizeKustomTotals shipping_quoted', () => {
  const base = { subtotal: 550, shipping_cost: 0, discount_amount: 0, tax_lines: [], total: 550, pricing_mode: 'INCLUSIVE' };

  it('keeps shipping_quoted when the API sends true', () => {
    const t = normalizeKustomTotals({ ...base, shipping_quoted: true } as never);
    expect(t?.shipping_quoted).toBe(true);
    expect(t?.shipping_cost).toBe(0);
  });

  it('omits it when false or absent (0 stays "unknown")', () => {
    expect(normalizeKustomTotals({ ...base, shipping_quoted: false } as never)).not.toHaveProperty('shipping_quoted');
    expect(normalizeKustomTotals(base as never)).not.toHaveProperty('shipping_quoted');
  });
});
