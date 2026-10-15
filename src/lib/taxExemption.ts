// ── Exempt quotes in the summaries (b2b app, M2.5-DESIGN §5 / §10 item 9) ────
// When a quote / Kustom session is tax exempt (reverse charge or a customer
// exemption), its `items[].unit_price` are what the company actually pays:
// already net on a `net`-pricing INCLUSIVE store, the unchanged price on a
// `gross` one. The company-view helper `netFromGross` must never be applied
// on top of them (double netting). These helpers pick the right amount.
//
// Pure module — vitest covered.

import { normalizeTaxExemptReason, type TaxExemptReason } from './tax';
import { normalizeWhy, type ReverseChargeWhy } from './vatCheck';
import type { ReverseChargePricing } from './b2bSettings';

/** `tax_exemption` block of a quote / Kustom session (absent without the app). */
export interface QuoteTaxExemption {
  reason: TaxExemptReason | null;
  vat_number: string | null;
  name: string | null;
  checked_at: string | null;
  why: ReverseChargeWhy | null;
}

export function normalizeQuoteTaxExemption(raw: unknown): QuoteTaxExemption | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    reason: normalizeTaxExemptReason(r.reason),
    vat_number: str(r.vat_number),
    name: str(r.name),
    checked_at: str(r.checked_at),
    why: normalizeWhy(r.why),
  };
}

/** Quote item fields used to match a cart line. */
export interface QuoteItemLike {
  product_id?: string | null;
  variant_id?: string | null;
  custom_product_id?: string | null;
  bundle_offer_id?: string | null;
  unit_price?: number | string | null;
  original_unit_price?: number | string | null;
}

/** Cart line fields used to match a quote item. */
export interface CartLineLike {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  customProductId?: string | null;
  bundleOfferId?: string | null;
}

export interface ExemptLinePrice {
  unit: number;
  original: number | null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Same identity the order lines use: a custom product wins over its base
// product (guest custom lines carry the custom id in both fields).
function quoteKey(q: QuoteItemLike): string {
  const product = q.custom_product_id ? `c:${q.custom_product_id}` : `p:${q.product_id ?? ''}`;
  return `${product}|${q.variant_id ?? ''}|${q.bundle_offer_id ?? ''}`;
}
function cartKey(c: CartLineLike): string {
  const product = c.customProductId ? `c:${c.customProductId}` : `p:${c.productId ?? ''}`;
  return `${product}|${c.variantId ?? ''}|${c.bundleOfferId ?? ''}`;
}

/**
 * Map cart line id → the exempt quote's unit price (as-is). Lines are
 * matched by product / variant / bundle identity, in order for repeated
 * identities. Lines without a match are left out (the caller falls back).
 */
export function exemptLinePrices(quoteItems: unknown, cartLines: CartLineLike[]): Record<string, ExemptLinePrice> {
  const out: Record<string, ExemptLinePrice> = {};
  if (!Array.isArray(quoteItems)) return out;
  const queues = new Map<string, QuoteItemLike[]>();
  for (const raw of quoteItems) {
    if (!raw || typeof raw !== 'object') continue;
    const q = raw as QuoteItemLike;
    const k = quoteKey(q);
    const list = queues.get(k);
    if (list) list.push(q);
    else queues.set(k, [q]);
  }
  for (const line of cartLines) {
    const q = queues.get(cartKey(line))?.shift();
    if (!q) continue;
    const unit = num(q.unit_price);
    if (unit === null) continue;
    out[line.id] = { unit, original: num(q.original_unit_price) };
  }
  return out;
}

export interface SummaryUnitInput {
  itemId: string;
  /** Cart price as the API sent it (gross in INCLUSIVE stores). */
  price: number;
  /** Bundle "was" price, same basis as `price`; null = none. */
  originalPrice: number | null;
  /** Exempt reason of the quote / session the summary shows; null = taxed. */
  exemptReason: TaxExemptReason | null;
  /** Exempt quote prices per cart line (from `exemptLinePrices`). */
  exemptPrices: Record<string, ExemptLinePrice> | null;
  pricing: ReverseChargePricing;
  /** Company / person display of a taxed price (`useDisplayPrice`). */
  display: (amount: number) => number;
  /** Net of a price (INCLUSIVE: `netFromGross` with the line's rate;
   *  EXCLUSIVE: identity). Used for any exemption on `net` pricing when the
   *  quote / session has no per-line amounts — persons included. */
  net: (amount: number) => number;
}

/**
 * Unit amount (+ bundle "was" amount) one summary line shows:
 *   - exempt quote with a price for the line → that price, untouched;
 *   - exempt without line prices (Kustom totals) on `gross` pricing → the
 *     unchanged cart price (the buyer pays it, VAT 0); on `net` pricing →
 *     the net of the cart price (same registration rate as the API);
 *   - otherwise the regular display (net estimate for companies).
 */
export function summaryUnitAmounts(input: SummaryUnitInput): { unit: number; original: number | null } {
  const { itemId, price, originalPrice, exemptReason, exemptPrices, pricing, display, net } = input;
  if (exemptReason) {
    const exempt = exemptPrices?.[itemId];
    if (exempt) return { unit: exempt.unit, original: exempt.original ?? (originalPrice !== null ? net(originalPrice) : null) };
    if (pricing === 'gross') return { unit: price, original: originalPrice };
    // No per-line data: net it like the API does, whoever the buyer is.
    return { unit: net(price), original: originalPrice !== null ? net(originalPrice) : null };
  }
  return { unit: display(price), original: originalPrice !== null ? display(originalPrice) : null };
}
