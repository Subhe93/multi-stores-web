import { describe, expect, it } from 'vitest';
import { buildCartQuoteBody, defaultQuoteCountry, normalizeCartQuote, quoteTotalBeforeTax, quotedSummaryFigures } from './cartQuote';

describe('defaultQuoteCountry', () => {
  it('prefers the market first country, then the currency, then the store language', () => {
    expect(defaultQuoteCountry(['se', 'NO'], 'EUR', 'de')).toBe('SE');
    expect(defaultQuoteCountry([], 'SEK', 'en')).toBe('SE');
    expect(defaultQuoteCountry(null, 'EUR', 'de-AT')).toBe('DE');
    expect(defaultQuoteCountry(undefined, 'EUR', undefined)).toBeNull();
  });
});

describe('buildCartQuoteBody', () => {
  const base = { storeId: 's1', lines: [{ quantity: 1, product_id: 'p1' }], countryCode: 'SE', couponCode: null, locale: 'sv', isCompany: false };
  it('builds the checkout quote body', () => {
    expect(buildCartQuoteBody(base)).toEqual({ store_id: 's1', lines: [{ quantity: 1, product_id: 'p1' }], country_code: 'SE', locale: 'sv' });
  });
  it('adds market, preview, coupon and company; omits lines for the server cart', () => {
    expect(buildCartQuoteBody({ ...base, marketKey: 'se', marketPreview: true, lines: null, couponCode: 'X', isCompany: true })).toEqual({
      store_id: 's1', market_key: 'se', preview: true, country_code: 'SE', coupon_code: 'X', locale: 'sv', buyer_type: 'COMPANY',
    });
  });
});

describe('normalizeCartQuote', () => {
  const ok = { subtotal: '300', shipping_cost: '49', discount_amount: 0, total: 349, currency: 'sek', tax_total: 69.8, tax_lines: [], shipping: { available: true } };
  it('reads the figures (numeric strings included)', () => {
    expect(normalizeCartQuote(ok, 'SEK')).toMatchObject({ subtotal: 300, shippingCost: 49, total: 349, currency: 'SEK', taxPricingMode: 'INCLUSIVE', b2b: null });
  });
  it('is null without a usable shipping quote, on a currency mismatch or a missing amount', () => {
    expect(normalizeCartQuote({ ...ok, shipping: null }, 'SEK')).toBeNull();
    expect(normalizeCartQuote({ ...ok, shipping: { available: false, message: 'x' } }, 'SEK')).toBeNull();
    expect(normalizeCartQuote(ok, 'EUR')).toBeNull();
    expect(normalizeCartQuote({ ...ok, total: undefined }, 'SEK')).toBeNull();
    expect(normalizeCartQuote(null, 'SEK')).toBeNull();
  });
  it('quoteTotalBeforeTax trims float noise', () => {
    expect(quoteTotalBeforeTax({ total: 436.25, taxTotal: 87.25 })).toBe(349);
  });
});

describe('quotedSummaryFigures', () => {
  it('uses the quote subtotal and discount once quoted (exempt or not)', () => {
    expect(quotedSummaryFigures({ subtotal: 320, discount_amount: 32 }, { subtotal: 300, discount: 40 })).toEqual({
      subtotal: 320,
      discount: 32,
    });
    // Decimal strings from the API.
    expect(quotedSummaryFigures({ subtotal: '320.50', discount_amount: '0' }, { subtotal: 300, discount: 40 })).toEqual({
      subtotal: 320.5,
      discount: 0,
    });
  });
  it('falls back to the client figures without a quote or a usable amount', () => {
    expect(quotedSummaryFigures(null, { subtotal: 300, discount: 40 })).toEqual({ subtotal: 300, discount: 40 });
    expect(quotedSummaryFigures({ subtotal: undefined, discount_amount: 'x' }, { subtotal: 300, discount: 40 })).toEqual({
      subtotal: 300,
      discount: 40,
    });
  });
});
