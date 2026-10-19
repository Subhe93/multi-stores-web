/**
 * Countries the checkout address form offers. Without the markets app the
 * legacy fixed list is returned unchanged.
 *
 * With a market (a country belongs to one LIVE market, whose domain sells in
 * its currency):
 * - a non-default market offers exactly its countries;
 * - the default market also serves every country no other market claims, so
 *   it offers the legacy list plus its own countries, minus the countries of
 *   the store's other markets (those buy on their own market's domain).
 * A market with no countries (and, for the default market, no other market
 * claiming any) keeps the legacy list. Otherwise the options are named in
 * the shopper's locale and sorted by that name. A saved address in another
 * country is still selectable as an address; this list only feeds the
 * new-address form.
 */

export interface CountryOption {
  code: string;
  name: string;
}

export interface CheckoutMarket {
  key: string;
  is_default: boolean;
  countries: readonly string[];
}

export function checkoutCountryOptions(
  legacy: readonly CountryOption[],
  market: CheckoutMarket | null | undefined,
  /** The store's reachable LIVE markets (the current one may be included). */
  markets: readonly Pick<CheckoutMarket, 'key' | 'countries'>[] | null | undefined,
  locale: string,
  /** The form's current value: kept selectable so it never disappears. */
  current?: string | null,
): CountryOption[] {
  if (!market) return [...legacy];
  const own = normalize(market.countries);
  let wanted: Set<string>;
  if (market.is_default) {
    const claimed = new Set(
      (markets ?? [])
        .filter((m) => m.key !== market.key)
        .flatMap((m) => normalize(m.countries)),
    );
    if (own.length === 0 && claimed.size === 0) return [...legacy];
    wanted = new Set(
      [...legacy.map((c) => c.code), ...own].filter((c) => !claimed.has(c)),
    );
  } else {
    if (own.length === 0) return [...legacy];
    wanted = new Set(own);
  }
  const cur = current?.trim().toUpperCase();
  if (cur && /^[A-Z]{2}$/.test(cur)) wanted.add(cur);
  const byCode = new Map(legacy.map((c) => [c.code, c.name]));
  const names = displayNames(locale);
  return [...wanted]
    .map((code) => ({ code, name: names?.of(code) || byCode.get(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function normalize(countries: readonly string[] | null | undefined): string[] {
  return (countries ?? [])
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

function displayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  } catch {
    return null;
  }
}
