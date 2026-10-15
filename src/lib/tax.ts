// ── Tax types + helpers (plans/tax-system/API-CONTRACT-TAX.md §3/§4) ─────────
// Tax is computed server-side only: GET /cart, POST /orders/quote, the Kustom
// session and orders all return itemized `tax_lines`. The storefront never
// derives a rate or an amount itself; it only formats what the API sent.

export type TaxPricingMode = 'INCLUSIVE' | 'EXCLUSIVE';

/** One (label, rate) group of an order / cart / quote, in major currency units. */
export interface TaxLine {
  /** Already localized by the API (e.g. "Moms", "VAT"). */
  label: string;
  /** 2500 = 25 %. */
  rate_bp: number;
  taxable_amount: number;
  tax_amount: number;
  /** b2b app M2.5: set only on the synthetic 0 % row of an exempt order. */
  exempt_reason?: TaxExemptReason;
}

/** Why an order / quote carries no VAT (b2b app, M2.5). */
export type TaxExemptReason = 'REVERSE_CHARGE' | 'CUSTOMER_EXEMPT';

/** Coerce an API `tax_exempt_reason` / `exempt_reason`; null for anything else. */
export function normalizeTaxExemptReason(raw: unknown): TaxExemptReason | null {
  return raw === 'REVERSE_CHARGE' || raw === 'CUSTOMER_EXEMPT' ? raw : null;
}

/** `tax` block of `storefront.getStore`. */
export interface StoreTaxConfig {
  pricing_mode: TaxPricingMode;
  /** Catalog display: show the "incl. VAT" suffix next to prices (INCLUSIVE only). */
  display_prices_incl_tax: boolean;
  /** Registration country (ISO2) used for cart estimates; null = platform's. */
  country: string | null;
  registrant: 'STORE' | 'PLATFORM';
}

/** "2500" → "25 %", "1250" → "12.5 %". */
export function formatTaxRate(rateBp: number | null | undefined): string {
  const pct = Number(rateBp ?? 0) / 100;
  const text = Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(2)));
  return `${text} %`;
}

/** "Moms" + 2500 → "Moms 25 %" — the row label for an itemized tax line. */
export function taxLineLabel(line: Pick<TaxLine, 'label' | 'rate_bp'>): string {
  return `${line.label} ${formatTaxRate(line.rate_bp)}`;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce an API `tax_lines` value (may be null, a JSON string or Decimals as strings). */
export function normalizeTaxLines(raw: unknown): TaxLine[] {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === 'object')
    .map((l) => {
      const exempt = normalizeTaxExemptReason(l.exempt_reason ?? l.exemptReason);
      return {
        label: typeof l.label === 'string' ? l.label : '',
        rate_bp: toNumber(l.rate_bp ?? l.rateBp),
        taxable_amount: toNumber(l.taxable_amount ?? l.taxableAmount),
        tax_amount: toNumber(l.tax_amount ?? l.taxAmount),
        // Only the exempt row carries the key; ordinary rows stay identical.
        ...(exempt ? { exempt_reason: exempt } : {}),
      };
    });
}

/** Sum of `tax_amount` over the lines. */
export function sumTaxLines(lines: TaxLine[]): number {
  return lines.reduce((sum, l) => sum + l.tax_amount, 0);
}

export function normalizeTaxPricingMode(raw: unknown): TaxPricingMode | null {
  return raw === 'EXCLUSIVE' || raw === 'INCLUSIVE' ? raw : null;
}

/** Coerce the `tax` block of `storefront.getStore`; null when the API did not send one. */
export function normalizeStoreTax(raw: unknown): StoreTaxConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    pricing_mode: normalizeTaxPricingMode(r.pricing_mode) ?? 'INCLUSIVE',
    display_prices_incl_tax: r.display_prices_incl_tax !== false,
    country: typeof r.country === 'string' && r.country ? r.country.toUpperCase() : null,
    registrant: r.registrant === 'PLATFORM' ? 'PLATFORM' : 'STORE',
  };
}

/** Net figures the API derives for company views (b2b app, M2-DESIGN D3/D4). */
export interface B2bNetTotals {
  display_mode: 'incl' | 'excl';
  /** Σ line nets after the discount share. */
  net_items: number;
  net_shipping: number;
  /** `total − tax_total`. */
  net_total: number;
}

/** Coerce a `b2b` block of GET /cart, POST /orders/quote or a Kustom session; null when absent. */
export function normalizeB2bNetTotals(raw: unknown): B2bNetTotals | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!('net_total' in r) && !('net_items' in r) && !('netTotal' in r) && !('netItems' in r)) return null;
  const netItems = toNumber(r.net_items ?? r.netItems);
  const netShipping = toNumber(r.net_shipping ?? r.netShipping);
  const netTotal = 'net_total' in r || 'netTotal' in r ? toNumber(r.net_total ?? r.netTotal) : netItems + netShipping;
  return {
    display_mode: (r.display_mode ?? r.displayMode) === 'excl' ? 'excl' : 'incl',
    net_items: netItems,
    net_shipping: netShipping,
    net_total: netTotal,
  };
}

/**
 * Net figures of a stored order, derived rather than stored (M2-DESIGN D4,
 * mirror of the API's `deriveNetTotals`): `gross = total`,
 * `net_total = total − tax_amount`, `net_shipping = INCLUSIVE ?
 * shipping_cost − shipping_tax_amount : shipping_cost`. `tax_amount` falls
 * back to the sum of `tax_lines` for orders that only carry the lines.
 */
export function deriveNetTotals(order: {
  total?: number | string | null;
  tax_amount?: number | string | null;
  tax_lines?: unknown;
  shipping_cost?: number | string | null;
  shipping_tax_amount?: number | string | null;
  tax_pricing_mode?: TaxPricingMode | string | null;
}): B2bNetTotals {
  const total = toNumber(order.total);
  const taxAmount =
    order.tax_amount !== undefined && order.tax_amount !== null
      ? toNumber(order.tax_amount)
      : sumTaxLines(normalizeTaxLines(order.tax_lines));
  const shipping = toNumber(order.shipping_cost);
  const shippingTax = toNumber(order.shipping_tax_amount);
  const inclusive = order.tax_pricing_mode !== 'EXCLUSIVE';
  // Trim float noise from the subtractions (amounts are major units).
  const clean = (n: number) => Math.max(0, Math.round(n * 1e6) / 1e6);
  const netShipping = clean(inclusive ? shipping - shippingTax : shipping);
  const netTotal = clean(total - taxAmount);
  return {
    display_mode: 'excl',
    net_items: clean(netTotal - netShipping),
    net_shipping: netShipping,
    net_total: netTotal,
  };
}

/**
 * Older orders (pre tax-system) carry only `tax_rate_bp` / `tax_amount`; the
 * migration back-fills `tax_lines`, but keep a one-line fallback so a receipt
 * never loses its VAT row. `label` is the caller's translated "Tax".
 */
export function taxLinesFromLegacy(
  order: { tax_lines?: unknown; tax_rate_bp?: number | null; tax_amount?: number | string | null; total?: number | string },
  label: string,
): TaxLine[] {
  const lines = normalizeTaxLines(order.tax_lines);
  if (lines.length > 0) return lines;
  const amount = toNumber(order.tax_amount);
  if (amount <= 0) return [];
  return [{
    label,
    rate_bp: toNumber(order.tax_rate_bp),
    taxable_amount: Math.max(0, toNumber(order.total) - amount),
    tax_amount: amount,
  }];
}
