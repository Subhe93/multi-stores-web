import { roundToMinorUnit } from '@/lib/format';

// ── Tax helpers ───────────────────────────────────────────────────────────────
// Prices are tax inclusive platform-wide; the rate is given in basis points
// (2500 = 25 %). The VAT line is informational only — totals never change.

/**
 * VAT included in a tax-inclusive amount:
 * `included = amount - amount * 10000 / (10000 + rate)`, rounded to the
 * currency's minor unit. Returns 0 for a zero / missing rate.
 */
export function includedTax(total: number, rateBp: number | null | undefined, currency = 'EUR'): number {
  const rate = Number(rateBp ?? 0);
  if (!Number.isFinite(total) || !Number.isFinite(rate) || rate <= 0 || total <= 0) return 0;
  return roundToMinorUnit(total - (total * 10000) / (10000 + rate), currency);
}

/** "2500" → "25 %", "1250" → "12.5 %". */
export function formatTaxRate(rateBp: number | null | undefined): string {
  const pct = Number(rateBp ?? 0) / 100;
  const text = Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(2)));
  return `${text} %`;
}

/** True when a VAT line should be shown for this rate. */
export function hasTax(rateBp: number | null | undefined): boolean {
  return Number(rateBp ?? 0) > 0;
}
