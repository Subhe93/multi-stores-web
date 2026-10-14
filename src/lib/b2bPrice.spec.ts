import { describe, expect, it } from 'vitest';
import { displayPrice, isKnownRate, netFromGross } from './b2bPrice';

describe('netFromGross', () => {
  it('divides out the rate and rounds to the minor unit', () => {
    expect(netFromGross(125, 2500, 'SEK')).toBe(100);
    expect(netFromGross(119, 1900, 'EUR')).toBe(100);
    expect(netFromGross(99.99, 2500, 'EUR')).toBe(79.99);
    expect(netFromGross(10, 1250, 'EUR')).toBe(8.89);
  });

  it('respects zero-decimal and three-decimal currencies', () => {
    expect(netFromGross(1250, 2500, 'JPY')).toBe(1000);
    expect(netFromGross(1000, 1000, 'JPY')).toBe(909);
    expect(netFromGross(1.25, 2500, 'KWD')).toBe(1);
    expect(netFromGross(10, 1500, 'BHD')).toBe(8.696);
  });

  it('falls back to the gross for an unknown rate and never returns NaN', () => {
    expect(netFromGross(125, null)).toBe(125);
    expect(netFromGross(125, undefined)).toBe(125);
    expect(netFromGross(125, Number.NaN)).toBe(125);
    expect(netFromGross(125, -1)).toBe(125);
    expect(netFromGross(Number.NaN, 2500)).toBe(0);
    expect(netFromGross(125, 0)).toBe(125);
  });

  it('isKnownRate', () => {
    expect(isKnownRate(2500)).toBe(true);
    expect(isKnownRate(0)).toBe(true);
    expect(isKnownRate(null)).toBe(false);
    expect(isKnownRate('2500')).toBe(false);
    expect(isKnownRate(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('displayPrice matrix', () => {
  const base = { amount: 125, taxRateBp: 2500, currency: 'SEK' };

  it('person / INCLUSIVE / display flag on: gross + incl', () => {
    expect(displayPrice({ ...base, pricingMode: 'INCLUSIVE', displayInclTax: true, isCompany: false }))
      .toEqual({ amount: 125, suffix: 'incl', plusVatRateBp: null });
  });

  it('person / INCLUSIVE / display flag off: gross, no suffix', () => {
    expect(displayPrice({ ...base, pricingMode: 'INCLUSIVE', displayInclTax: false, isCompany: false }))
      .toEqual({ amount: 125, suffix: null, plusVatRateBp: null });
  });

  it('person / EXCLUSIVE: amount as sent + excl (unchanged, L3)', () => {
    expect(displayPrice({ ...base, amount: 100, pricingMode: 'EXCLUSIVE', displayInclTax: true, isCompany: false }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: null });
    expect(displayPrice({ ...base, amount: 100, pricingMode: 'EXCLUSIVE', displayInclTax: false, isCompany: false }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: null });
  });

  it('company / INCLUSIVE: net + excl + rate, regardless of the display flag', () => {
    expect(displayPrice({ ...base, pricingMode: 'INCLUSIVE', displayInclTax: true, isCompany: true }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: 2500 });
    expect(displayPrice({ ...base, pricingMode: 'INCLUSIVE', displayInclTax: false, isCompany: true }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: 2500 });
  });

  it('company / EXCLUSIVE: net as sent + excl + rate', () => {
    expect(displayPrice({ ...base, amount: 100, pricingMode: 'EXCLUSIVE', displayInclTax: false, isCompany: true }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: 2500 });
    expect(displayPrice({ ...base, amount: 100, taxRateBp: null, pricingMode: 'EXCLUSIVE', displayInclTax: false, isCompany: true }))
      .toEqual({ amount: 100, suffix: 'excl', plusVatRateBp: null });
  });

  it('company / INCLUSIVE with an unknown rate: honest gross fallback = person view', () => {
    expect(displayPrice({ ...base, taxRateBp: null, pricingMode: 'INCLUSIVE', displayInclTax: true, isCompany: true }))
      .toEqual({ amount: 125, suffix: 'incl', plusVatRateBp: null });
    expect(displayPrice({ ...base, taxRateBp: undefined, pricingMode: 'INCLUSIVE', displayInclTax: false, isCompany: true }))
      .toEqual({ amount: 125, suffix: null, plusVatRateBp: null });
  });

  it('company with a zero rate shows the gross as net with a 0 % hint', () => {
    expect(displayPrice({ ...base, taxRateBp: 0, pricingMode: 'INCLUSIVE', displayInclTax: true, isCompany: true }))
      .toEqual({ amount: 125, suffix: 'excl', plusVatRateBp: 0 });
  });

  it('never produces NaN', () => {
    const r = displayPrice({ amount: Number.NaN, taxRateBp: 2500, pricingMode: 'INCLUSIVE', displayInclTax: true, isCompany: true });
    expect(Number.isNaN(r.amount)).toBe(false);
  });
});
