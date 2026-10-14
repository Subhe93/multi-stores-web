import { describe, expect, it } from 'vitest';
import { availableLines, hasUnavailableLines, sumLineTotals } from './cartAvailability';

const ok = { price: 100, quantity: 2 };
const hidden = { price: 999, quantity: 1, unavailableInMarket: true };

describe('cartAvailability', () => {
  it('skips unavailable lines in the subtotal', () => {
    expect(sumLineTotals([ok, hidden])).toBe(200);
    expect(sumLineTotals([hidden])).toBe(0);
  });
  it('filters available lines', () => {
    expect(availableLines([ok, hidden])).toEqual([ok]);
  });
  it('detects unavailable lines', () => {
    expect(hasUnavailableLines([ok])).toBe(false);
    expect(hasUnavailableLines([ok, hidden])).toBe(true);
  });
});
