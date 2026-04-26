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
