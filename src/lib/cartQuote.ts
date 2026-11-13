// ── Cart page shipping quote (pure helpers) ──────────────────────────────────
// The full cart page prices the cart through POST /orders/quote for the
// market's default destination, the same OrdersService.quoteLines path the
// checkout summary and the Kustom session use, so the cart shows the exact
// shipping and total the shopper will see at checkout. These helpers hold
// everything that does not need React (vitest `unit` project).

import { marketBody } from './market';
import { normalizeB2bNetTotals, normalizeTaxLines, normalizeTaxPricingMode, sumTaxLines, type B2bNetTotals, type TaxLine, type TaxPricingMode } from './tax';
import type { KustomCartLine } from '@/hooks/useKustomCheckout';

/** Typing a postcode / switching methods / stepping quantities re-quotes; coalesce bursts. */
export const QUOTE_DEBOUNCE_MS = 400;

// Where a store is assumed to ship before an address is known: mirror of
// kustom-checkout.service `defaultCountry` (market's first country, else the
// currency's home market, else the store language's country). MARKETPLACE
// stores also pass the customer's saved country and the tax country (see
// below and useCartQuote); INDEPENDENT stores pass neither, so the mirror
// holds for every Kustom store.
const CURRENCY_COUNTRIES: Record<string, string> = {
  SEK: 'SE', NOK: 'NO', DKK: 'DK', GBP: 'GB', USD: 'US', CHF: 'CH', PLN: 'PL',
  CZK: 'CZ', HUF: 'HU', RON: 'RO', AUD: 'AU', NZD: 'NZ', CAD: 'CA',
};
const LOCALE_COUNTRIES: Record<string, string> = {
  sv: 'SE', nb: 'NO', no: 'NO', da: 'DK', fi: 'FI', de: 'DE', fr: 'FR',
  nl: 'NL', tr: 'TR', en: 'GB', pl: 'PL', es: 'ES',
};

const iso2 = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
};

/**
 * Default destination country (ISO2, upper-case) of the cart quote; null when
 * unknown. Order: the logged-in customer's saved address country (when the
 * market ships there, or there is no market), the market's first country,
 * the currency's home country, the store's tax registration country, then
 * the store language's country. The tax country comes before the language
 * so a EUR store in English (marketplace stores: tax country SE) is not
 * quoted for the United Kingdom.
 */
export function defaultQuoteCountry(
  marketCountries: readonly string[] | null | undefined,
  currency: string | null | undefined,
  primaryLocale: string | null | undefined,
  taxCountry?: string | null,
  savedCountry?: string | null,
): string | null {
  const markets = (marketCountries ?? []).map(iso2).filter((c): c is string => Boolean(c));
  const saved = iso2(savedCountry);
  if (saved && (markets.length === 0 || markets.includes(saved))) return saved;
  if (markets[0]) return markets[0];
  const byCurrency = currency ? CURRENCY_COUNTRIES[currency.toUpperCase()] : undefined;
  if (byCurrency) return byCurrency;
  const byTax = iso2(taxCountry);
  if (byTax) return byTax;
  const lang = (primaryLocale ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return LOCALE_COUNTRIES[lang] ?? null;
}

/**
 * Quote / order error codes meaning "this coupon cannot be used on these
 * items" (marketplace provider-cost floor). The cart drops the discount,
 * re-quotes without the code and offers to remove it.
 */
export const COUPON_BELOW_COST_CODES: ReadonlySet<string> = new Set([
  'ORDER_DISCOUNT_BELOW_PROVIDER_COST',
  'PROMOTION_COUPON_BELOW_COST',
]);

/**
 * Client-side coupon figures of a summary (checkout before / without a
 * quote). When the quote refused the applied coupon (provider-cost floor)
 * the order will not grant it: no discount, no free shipping, and the
 * un-discounted total, like the cart page.
 */
export function clientCouponFigures(input: {
  subtotal: number;
  total: number;
  discount: number;
  couponFreeShipping: boolean;
  refused: boolean;
}): { discount: number; total: number; freeShipping: boolean } {
  return input.refused
    ? { discount: 0, total: input.subtotal, freeShipping: false }
    : { discount: input.discount, total: input.total, freeShipping: input.couponFreeShipping };
}

/** The error's code when it is a coupon-below-cost rejection, else null. */
export function couponBelowCostCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && COUPON_BELOW_COST_CODES.has(code) ? code : null;
}

export interface CartQuoteRequest {
  storeId: string;
  marketKey?: string;
  marketPreview?: boolean;
  /** Guest lines (toKustomCartLines); null for a logged-in shopper (server cart). */
  lines: KustomCartLine[] | null;
  countryCode: string;
  couponCode: string | null;
  locale: string;
  isCompany: boolean;
}

/** Body of POST /orders/quote, built exactly like the checkout summary's quote. */
export function buildCartQuoteBody(req: CartQuoteRequest): Record<string, unknown> {
  return {
    store_id: req.storeId,
    ...marketBody(req.marketKey ? { key: req.marketKey, preview: req.marketPreview } : null),
    ...(req.lines ? { lines: req.lines } : {}),
    country_code: req.countryCode,
    ...(req.couponCode ? { coupon_code: req.couponCode } : {}),
    locale: req.locale,
    // b2b app: the company quote carries the `b2b` net block (same money).
    ...(req.isCompany ? { buyer_type: 'COMPANY' } : {}),
  };
}

/** The figures of a usable quote, in the cart currency (major units). */
export interface CartQuote {
  subtotal: number;
  shippingCost: number;
  discount: number;
  /** Grand total: INCLUSIVE subtotal + shipping - discount; EXCLUSIVE plus tax. */
  total: number;
  taxTotal: number;
  taxLines: TaxLine[];
  taxPricingMode: TaxPricingMode;
  /** b2b app, company quote: net block; null otherwise. */
  b2b: B2bNetTotals | null;
  currency: string;
}

function money(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The quote figures, or null when the quote cannot be shown as the real
 * price: no shipping computed / not available for the destination, a
 * currency other than the cart's (never mix currencies), or a missing amount.
 */
export function normalizeCartQuote(raw: unknown, cartCurrency: string | null | undefined): CartQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const shipping = r.shipping as { available?: unknown } | null | undefined;
  if (!shipping || typeof shipping !== 'object' || shipping.available !== true) return null;
  const currency = typeof r.currency === 'string' ? r.currency.toUpperCase() : '';
  if (!currency || (cartCurrency && cartCurrency.toUpperCase() !== currency)) return null;
  const subtotal = money(r.subtotal);
  const shippingCost = money(r.shipping_cost);
  const total = money(r.total);
  if (subtotal === null || shippingCost === null || total === null || shippingCost < 0) return null;
  const taxLines = normalizeTaxLines(r.tax_lines);
  return {
    subtotal,
    shippingCost,
    discount: Math.max(0, money(r.discount_amount) ?? 0),
    total,
    taxTotal: money(r.tax_total) ?? sumTaxLines(taxLines),
    taxLines,
    taxPricingMode: normalizeTaxPricingMode(r.tax_pricing_mode) ?? 'INCLUSIVE',
    b2b: normalizeB2bNetTotals(r.b2b),
    currency,
  };
}

/** Total before tax of an EXCLUSIVE quote (`total - tax_total`), float noise trimmed. */
export function quoteTotalBeforeTax(quote: Pick<CartQuote, 'total' | 'taxTotal'>): number {
  return Math.round((quote.total - quote.taxTotal) * 100) / 100;
}

/**
 * Subtotal and discount rows of the checkout summary: the quote's figures
 * once there is one (the same quote the shown total comes from, so the rows
 * add up to what is charged), the client figures until then or when the
 * quote lacks a usable amount.
 */
export function quotedSummaryFigures(
  quote: { subtotal?: unknown; discount_amount?: unknown } | null | undefined,
  client: { subtotal: number; discount: number },
): { subtotal: number; discount: number } {
  const pick = (v: unknown, fallback: number): number => {
    if (!quote) return fallback;
    const n = money(v);
    return n === null ? fallback : n;
  };
  return { subtotal: pick(quote?.subtotal, client.subtotal), discount: pick(quote?.discount_amount, client.discount) };
}
