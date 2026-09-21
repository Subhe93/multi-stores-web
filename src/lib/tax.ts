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
    .map((l) => ({
      label: typeof l.label === 'string' ? l.label : '',
      rate_bp: toNumber(l.rate_bp ?? l.rateBp),
      taxable_amount: toNumber(l.taxable_amount ?? l.taxableAmount),
      tax_amount: toNumber(l.tax_amount ?? l.taxAmount),
    }));
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
