// ── Country/region + language picker core (M155) ─────────────────────────────
// Pure and client-safe (no next/*, no window): imported by the picker, the
// suggestion banner, the store layouts and vitest.
//
// Three rules live here so a later "country + language in the URL" plan
// (`/de-de/`, `/nl-be/`) only touches this module and `regionUrl.ts`:
//  - the visitor's chosen COUNTRY is stored itself (cookie `ms-region`), not
//    only the market it falls into;
//  - `regionLocales` is the ONLY source of language options for a country;
//  - `marketForCountry` maps a country to the market that sells there.

import type { MarketRoute } from './market';
import { isServableMarket } from './storeUrl';
import { switcherLocales } from './storeLocales';

export type RegionMarket = Pick<
  MarketRoute,
  'key' | 'default_locale' | 'locales' | 'countries' | 'currency' | 'is_default' | 'primary_hostname' | 'status'
>;

/** One row of the country list. `country: null` = "Other countries" (default market). */
export interface RegionOption {
  country: string | null;
  marketKey: string;
  currency: string;
}

/** Per-country language override (future: BE -> nl + fr). */
export type CountryLocales = Readonly<Record<string, { default: string; locales: readonly string[] }>>;

export const REGION_COOKIE = 'ms-region';
/** Cross-origin hand-off of the chosen country (like the cart's `?c=`). */
export const REGION_PARAM = 'rg';
export const REGION_MAX_AGE_S = 365 * 24 * 60 * 60;

const ISO2 = /^[A-Z]{2}$/;

function normCountry(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().toUpperCase();
  return ISO2.test(c) ? c : null;
}

function servable<M extends RegionMarket>(markets: readonly M[] | null | undefined): M[] {
  return (markets ?? []).filter(isServableMarket);
}

function defaultMarket<M extends RegionMarket>(markets: readonly M[]): M | null {
  return markets.find((m) => m.is_default) ?? null;
}

/** Region mode only when 2+ servable LIVE markets exist (the same filter as MarketProvider). */
export function isRegionMode(markets: readonly RegionMarket[] | null | undefined): boolean {
  return servable(markets).length >= 2;
}

/**
 * Markets in conflict-resolution order: the current market first, then the
 * default market, then list order. The first market listing a country owns it.
 */
function priorityOrder<M extends RegionMarket>(current: RegionMarket | null, markets: readonly M[]): M[] {
  const list = servable(markets);
  const rank = (m: M) => (current && m.key === current.key ? 0 : m.is_default ? 1 : 2);
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map((x) => x.m);
}

/**
 * Union of the servable markets' countries (ISO2, upper case, de-duplicated:
 * the current market wins a conflict, then the default market, then list
 * order), plus one { country: null } row for the default market. Unsorted:
 * the UI sorts by localised name.
 */
export function regionOptions(current: RegionMarket | null, markets: readonly RegionMarket[]): RegionOption[] {
  const out: RegionOption[] = [];
  const seen = new Set<string>();
  for (const m of priorityOrder(current, markets)) {
    for (const raw of m.countries ?? []) {
      const c = normCountry(raw);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push({ country: c, marketKey: m.key, currency: m.currency });
    }
  }
  const def = defaultMarket(servable(markets));
  if (def) out.push({ country: null, marketKey: def.key, currency: def.currency });
  return out;
}

/** Every country a servable market sells to (upper case). */
export function regionCountries(markets: readonly RegionMarket[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const m of servable(markets)) for (const raw of m.countries ?? []) {
    const c = normCountry(raw);
    if (c) out.add(c);
  }
  return out;
}

/** The market that sells to `country`. null / unknown -> the default market. */
export function marketForCountry<M extends RegionMarket>(
  country: string | null,
  current: RegionMarket | null,
  markets: readonly M[],
): M | null {
  const c = normCountry(country);
  const ordered = priorityOrder(current, markets);
  if (c) {
    const owner = ordered.find((m) => (m.countries ?? []).some((x) => normCountry(x) === c));
    if (owner) return owner;
  }
  return defaultMarket(ordered) ?? (current ? (ordered.find((m) => m.key === current.key) ?? null) : null);
}

export interface RegionLocalesContext {
  current: RegionMarket | null;
  markets: readonly RegionMarket[];
  /** Store / current market primary locale (used without the markets app). */
  primaryLocale: string;
  secondaryLocales: readonly string[];
  currentLocale: string;
  countryLocales?: CountryLocales | null;
}

function uniq(list: readonly string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

/**
 * THE single source of language options for a country. The first entry is
 * the default for that country. Review locales are filtered (switcherLocales).
 *  - no market (store without the app): [primary, ...switcherLocales(primary, secondary, currentLocale)]
 *  - market: m = marketForCountry(country); [m.default_locale, ...switcherLocales(m.default_locale, m.locales, currentLocale)]
 *  - `countryLocales[country]` overrides the market list, intersected with what
 *    the market serves (until the URL plan lands, a locale the market host
 *    does not serve would 404). An empty intersection keeps the market list.
 */
export function regionLocales(country: string | null, ctx: RegionLocalesContext): string[] {
  const m = ctx.current ? marketForCountry(country, ctx.current, ctx.markets) : null;
  if (!m) {
    return uniq([ctx.primaryLocale, ...switcherLocales(ctx.primaryLocale, ctx.secondaryLocales, ctx.currentLocale)]);
  }
  const marketList = uniq([m.default_locale, ...switcherLocales(m.default_locale, m.locales, ctx.currentLocale)]);
  const c = normCountry(country);
  const override = c ? ctx.countryLocales?.[c] : undefined;
  if (override) {
    const served = new Set([m.default_locale, ...m.locales]);
    const wanted = uniq([override.default, ...switcherLocales(override.default, override.locales, ctx.currentLocale)]);
    const kept = wanted.filter((l) => served.has(l));
    if (kept.length > 0) return kept;
  }
  return marketList;
}

/**
 * The country to show as selected: the stored preference when the current
 * market sells there, else the current market's only country, else null
 * (globe).
 */
export function selectedRegionCountry(preferred: string | null, current: RegionMarket | null): string | null {
  if (!current) return null;
  const countries = (current.countries ?? []).map(normCountry).filter((c): c is string => Boolean(c));
  const p = normCountry(preferred);
  if (p && countries.includes(p)) return p;
  return countries.length === 1 ? countries[0]! : null;
}

/** `ms-region` value -> ISO2 country, or null for anything else. */
export function parseRegionCookie(raw: string | null | undefined): string | null {
  return normCountry(raw);
}

/**
 * `document.cookie` string that stores (or, for null, deletes) the chosen
 * country on the current host.
 */
export function regionCookieString(country: string | null, secure = false): string {
  const c = normCountry(country);
  const sec = secure ? '; secure' : '';
  if (!c) return `${REGION_COOKIE}=; path=/; max-age=0; samesite=lax${sec}`;
  return `${REGION_COOKIE}=${c}; path=/; max-age=${REGION_MAX_AGE_S}; samesite=lax${sec}`;
}
