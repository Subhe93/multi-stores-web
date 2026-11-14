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

/** Answer of POST /shipping/countries for the cart's products. */
export interface ShippableCountries {
  /** False when no product has a shipping profile (ships anywhere). */
  restricted: boolean;
  countries: string[];
}

/** Normalizes a /shipping/countries response; null when unusable. */
export function normalizeShippableCountries(res: unknown): ShippableCountries | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as { restricted?: unknown; countries?: unknown };
  if (typeof r.restricted !== 'boolean') return null;
  const countries = Array.isArray(r.countries)
    ? normalize(r.countries.filter((c): c is string => typeof c === 'string'))
    : [];
  return { restricted: r.restricted, countries };
}

/**
 * Limits the options to the countries the cart can ship to (a shipping zone
 * for its products). Without a market (`options` is the fixed legacy list)
 * the shippable countries themselves are offered, named in the shopper's
 * locale and sorted, since the legacy list misses most of them (NO, FI, DK);
 * with a market its options are filtered, so another market's countries
 * never come back. The current value stays selectable so it never
 * disappears. Unknown (null), unrestricted, or a restriction that would
 * leave nothing keep the list unchanged: the shipping quote then explains
 * per country.
 */
export function restrictToShippable(
  options: readonly CountryOption[],
  shippable: ShippableCountries | null | undefined,
  opts: { current?: string | null; locale: string; marketScoped: boolean },
): CountryOption[] {
  if (!shippable || !shippable.restricted) return [...options];
  const allowed = new Set(shippable.countries);
  const cur = opts.current?.trim().toUpperCase();
  const keepCurrent = cur && /^[A-Z]{2}$/.test(cur) ? cur : null;
  if (!opts.marketScoped) {
    if (allowed.size === 0) return [...options];
    const codes = new Set(allowed);
    if (keepCurrent) codes.add(keepCurrent);
    const byCode = new Map(options.map((c) => [c.code, c.name]));
    const names = displayNames(opts.locale);
    return [...codes]
      .map((code) => ({ code, name: names?.of(code) || byCode.get(code) || code }))
      .sort((a, b) => a.name.localeCompare(b.name, opts.locale));
  }
  const kept = options.filter((o) => allowed.has(o.code) || o.code === keepCurrent);
  return kept.some((o) => allowed.has(o.code)) ? kept : [...options];
}

/**
 * Country the classic checkout pre-selects: the cart quote's default
 * country, once known, when the form is still empty, nothing was
 * pre-selected before (the shopper may clear it on purpose), and the
 * country is one of the offered options. Null = leave the form as it is.
 */
export function checkoutPrefillCountry(input: {
  defaultCountry: string | null;
  formCountry: string;
  alreadyPrefilled: boolean;
  options: readonly CountryOption[];
}): string | null {
  if (input.alreadyPrefilled || input.formCountry) return null;
  const code = input.defaultCountry?.trim().toUpperCase();
  if (!code) return null;
  return input.options.some((o) => o.code === code) ? code : null;
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
