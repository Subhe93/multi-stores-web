/**
 * Shared price formatting utility.
 * Replaces scattered `new Intl.NumberFormat(...)` calls across components.
 */
export function formatPrice(
  amount: number,
  currency = 'EUR',
  locale = 'en',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

// ISO 4217 currencies whose minor unit is not 1/100.
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Number of minor-unit digits for a currency (2 for most, 0 for JPY/KRW-style). */
export function currencyMinorDigits(currency = 'EUR'): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Round an amount to the currency's minor unit (half away from zero). */
export function roundToMinorUnit(amount: number, currency = 'EUR'): number {
  const factor = 10 ** currencyMinorDigits(currency);
  return Math.round(amount * factor) / factor;
}
