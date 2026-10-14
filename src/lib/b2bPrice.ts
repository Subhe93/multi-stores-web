// ── Company price display (plans/namez-store-apps/M2-DESIGN.md D2 / §4.3) ────
// The catalog stays cache-neutral: the API never prices per buyer type.
// Instead products / cart lines of a b2b store carry the estimated
// `tax_rate_bp`, and the storefront derives the net amount client-side for
// the company view. Server totals stay authoritative (L8 / L11).
//
//   store pricing_mode / display flag | Person (today)      | Company
//   INCLUSIVE / true                  | gross, "incl. VAT"  | net, "excl. VAT" + "+25 % VAT"
//   INCLUSIVE / false                 | gross, no suffix    | net, "excl. VAT" + "+25 % VAT"
//   EXCLUSIVE / any                   | net, "excl. VAT"    | net, "excl. VAT" + "+25 % VAT"
//   Company with an unknown rate      | —                   | gross, person suffix (honest fallback)
//
// Pure module — vitest covered.

import { roundToMinorUnit } from './format';
import type { TaxPricingMode } from './tax';

export interface DisplayPriceInput {
  /** Amount as the API sent it (gross in INCLUSIVE stores, net in EXCLUSIVE). */
  amount: number;
  /** Estimated rate in basis points (2500 = 25 %); null/undefined = unknown. */
  taxRateBp?: number | null;
  pricingMode: TaxPricingMode;
  /** `display_prices_incl_tax` of the store (INCLUSIVE catalog suffix). */
  displayInclTax: boolean;
  isCompany: boolean;
  currency?: string;
}

export interface DisplayPriceResult {
  amount: number;
  /** Which suffix to show next to the amount; null = none. */
  suffix: 'incl' | 'excl' | null;
  /** Company view only: the rate for the "+25 % VAT" hint; null = not shown. */
  plusVatRateBp: number | null;
}

function toFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True when `rateBp` is a usable, non-negative finite rate. */
export function isKnownRate(rateBp: unknown): rateBp is number {
  return typeof rateBp === 'number' && Number.isFinite(rateBp) && rateBp >= 0;
}

/**
 * `gross / (1 + rate)` rounded to the currency's minor unit. Never NaN: a
 * non-finite amount yields 0 and an unknown rate returns the gross unchanged.
 */
export function netFromGross(gross: number, rateBp: number | null | undefined, currency = 'EUR'): number {
  const amount = toFiniteNumber(gross);
  if (!isKnownRate(rateBp)) return amount;
  return roundToMinorUnit(amount / (1 + rateBp / 10000), currency);
}

/** Amount + suffix + "+VAT" hint for one price (see the matrix above). */
export function displayPrice({
  amount,
  taxRateBp,
  pricingMode,
  displayInclTax,
  isCompany,
  currency = 'EUR',
}: DisplayPriceInput): DisplayPriceResult {
  const gross = toFiniteNumber(amount);
  const personSuffix: DisplayPriceResult['suffix'] =
    pricingMode === 'EXCLUSIVE' ? 'excl' : displayInclTax ? 'incl' : null;

  if (!isCompany) {
    return { amount: gross, suffix: personSuffix, plusVatRateBp: null };
  }

  if (pricingMode === 'EXCLUSIVE') {
    // Prices are already net; the company view only adds the rate hint.
    return { amount: gross, suffix: 'excl', plusVatRateBp: isKnownRate(taxRateBp) ? taxRateBp : null };
  }

  if (!isKnownRate(taxRateBp)) {
    // Unknown rate (guest line added before the app, older API): stay honest
    // and show exactly what a person sees.
    return { amount: gross, suffix: personSuffix, plusVatRateBp: null };
  }

  return {
    amount: netFromGross(gross, taxRateBp, currency),
    suffix: 'excl',
    plusVatRateBp: taxRateBp,
  };
}
