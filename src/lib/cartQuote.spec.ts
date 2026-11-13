import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COUPON_BELOW_COST_CODES, buildCartQuoteBody, clientCouponFigures, couponBelowCostCode, defaultQuoteCountry, normalizeCartQuote, quoteTotalBeforeTax, quotedSummaryFigures } from './cartQuote';

describe('clientCouponFigures (checkout summary without a quote)', () => {
  it('keeps the client discount, total and free shipping of an accepted coupon', () => {
    expect(clientCouponFigures({ subtotal: 300, total: 210, discount: 90, couponFreeShipping: true, refused: false }))
      .toEqual({ discount: 90, total: 210, freeShipping: true });
  });
  it('a coupon the quote refused (provider-cost floor) shows no discount, no free shipping, the full total', () => {
    expect(clientCouponFigures({ subtotal: 300, total: 210, discount: 90, couponFreeShipping: true, refused: true }))
      .toEqual({ discount: 0, total: 300, freeShipping: false });
  });
});

describe('defaultQuoteCountry', () => {
  it('prefers the market first country, then the currency, then the store language', () => {
    expect(defaultQuoteCountry(['se', 'NO'], 'EUR', 'de')).toBe('SE');
    expect(defaultQuoteCountry([], 'SEK', 'en')).toBe('SE');
    expect(defaultQuoteCountry(null, 'EUR', 'de-AT')).toBe('DE');
    expect(defaultQuoteCountry(undefined, 'EUR', undefined)).toBeNull();
  });

  it('uses the store tax country before the language (marketplace EUR + en + tax SE => SE, not GB)', () => {
    expect(defaultQuoteCountry(null, 'EUR', 'en', 'SE')).toBe('SE');
    expect(defaultQuoteCountry([], 'EUR', 'en', 'se')).toBe('SE');
    // Market and currency still come first.
    expect(defaultQuoteCountry(['DE'], 'EUR', 'en', 'SE')).toBe('DE');
    expect(defaultQuoteCountry(null, 'NOK', 'en', 'SE')).toBe('NO');
    // No (or an invalid) tax country: the language as before.
    expect(defaultQuoteCountry(null, 'EUR', 'en', null)).toBe('GB');
    expect(defaultQuoteCountry(null, 'EUR', 'en', 'Sweden')).toBe('GB');
  });

  it("prefers the customer's saved country when the market ships there (or there is no market)", () => {
    expect(defaultQuoteCountry(null, 'EUR', 'en', 'SE', 'fi')).toBe('FI');
    expect(defaultQuoteCountry(['SE', 'NO'], 'SEK', 'sv', 'SE', 'NO')).toBe('NO');
    // Outside the market: the market's first country.
    expect(defaultQuoteCountry(['SE'], 'SEK', 'sv', 'SE', 'DE')).toBe('SE');
    expect(defaultQuoteCountry(null, 'SEK', 'sv', null, '')).toBe('SE');
  });
});

describe('coupon-below-cost translations (checkout shows errors.<code> via useApiError)', () => {
  const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
  const read = (locale: string) =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8')) as Record<string, Record<string, unknown>>;
  it.each(LOCALES)('%s has every code and the cart / banner notes', (locale) => {
    const m = read(locale);
    for (const code of COUPON_BELOW_COST_CODES) {
      expect(typeof m.errors![code]).toBe('string');
      expect(String(m.errors![code]).length).toBeGreaterThan(10);
    }
    expect(m.cart!.couponNotApplicableToItems).toContain('{code}');
    expect(m.product!.couponBelowCost).toContain('{code}');
    expect(typeof m.cart!.estimatedTotal).toBe('string');
    expect(typeof m.cart!.finalTotalAtCheckout).toBe('string');
  });
});

describe('couponBelowCostCode', () => {
  it('recognises the provider-cost floor codes only', () => {
    expect(couponBelowCostCode({ code: 'ORDER_DISCOUNT_BELOW_PROVIDER_COST' })).toBe('ORDER_DISCOUNT_BELOW_PROVIDER_COST');
    expect(couponBelowCostCode({ code: 'PROMOTION_COUPON_BELOW_COST' })).toBe('PROMOTION_COUPON_BELOW_COST');
    expect(couponBelowCostCode({ code: 'PROMOTION_COUPON_INVALID' })).toBeNull();
    expect(couponBelowCostCode(new Error('x'))).toBeNull();
    expect(couponBelowCostCode(null)).toBeNull();
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
