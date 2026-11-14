'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, readStoredAccessToken } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useMarket } from '@/hooks/useMarket';
import { useBuyerType } from '@/hooks/useBuyerType';
import { useStorePrimaryLocale } from '@/hooks/useStorePrimaryLocale';
import { useStoreTax } from '@/hooks/useStoreTax';
import { toKustomCartLines } from '@/hooks/useKustomCheckout';
import { checkoutViewerHeaders } from '@/lib/storePreview';
import { readEditHintToken } from '@/components/edit-hint/editHintStorage';
import {
  QUOTE_DEBOUNCE_MS,
  buildCartQuoteBody,
  couponBelowCostCode,
  defaultQuoteCountry,
  normalizeCartQuote,
  type CartQuote,
} from '@/lib/cartQuote';

// ── Cart page quote (real shipping + total) ──────────────────────────────────
// POST /orders/quote for the market's default destination country with the
// applied coupon, exactly like the checkout summary / Kustom session price
// the cart. Guests send their local lines; a logged-in shopper omits them so
// the server quotes its cart. Debounced, stale responses dropped, and no
// request while the cart is empty, loading or blocked (lines unavailable in
// this market). A quote that does not match the current inputs is never
// shown: `status` stays 'loading' until the answer for these inputs lands.

export type CartQuoteState =
  /** Nothing to quote (empty / loading cart). */
  | { status: 'idle'; countryCode: string | null; quote: null; couponRejected: null }
  | { status: 'loading'; countryCode: string | null; quote: null; couponRejected: null }
  /**
   * The real figures for `countryCode`. `couponRejected` is the error code
   * when the applied coupon cannot be used on these items (provider-cost
   * floor): the figures are then quoted without the coupon.
   */
  | { status: 'ready'; countryCode: string; quote: CartQuote; couponRejected: string | null }
  /** No usable quote (error, shipping unavailable, no default country, blocked cart). */
  | { status: 'unknown'; countryCode: string | null; quote: null; couponRejected: string | null };

interface Settled {
  key: string;
  quote: CartQuote | null;
  couponRejected: string | null;
}

// Saved address country per session token, shared by every cart page view
// and re-read after SAVED_COUNTRY_TTL_MS (the shopper may have added or
// changed an address since). `null` = no saved address (or the read failed).
export const SAVED_COUNTRY_TTL_MS = 5 * 60 * 1000;
const savedCountryCache = new Map<string, { country: string | null; at: number }>();

function freshSavedCountry(token: string): { country: string | null } | null {
  const hit = savedCountryCache.get(token);
  if (!hit) return null;
  if (Date.now() - hit.at > SAVED_COUNTRY_TTL_MS) return null;
  return hit;
}

/** Country of the customer's default (else first) saved address. */
export function savedAddressCountry(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const rows = list.filter((a): a is { country_code?: unknown; is_default?: unknown } => Boolean(a) && typeof a === 'object');
  const pick = rows.find((a) => a.is_default === true) ?? rows[0];
  return pick && typeof pick.country_code === 'string' && pick.country_code ? pick.country_code.toUpperCase() : null;
}

/** Test hook: forget the cached saved-address countries. */
export function resetSavedCountryCache(): void {
  savedCountryCache.clear();
}

function useSavedCountry(token: string | null | undefined): { done: boolean; country: string | null } {
  const [, setTick] = useState(0);
  const fresh = token ? freshSavedCountry(token) : null;
  useEffect(() => {
    if (!token || freshSavedCountry(token)) return;
    let cancelled = false;
    api<unknown>('/customers/me/addresses', { token })
      .then((list) => { savedCountryCache.set(token, { country: savedAddressCountry(list), at: Date.now() }); })
      .catch(() => { savedCountryCache.set(token, { country: null, at: Date.now() }); })
      .finally(() => { if (!cancelled) setTick((n) => n + 1); });
    return () => { cancelled = true; };
  }, [token, fresh]);
  if (!token) return { done: true, country: null };
  // A stale entry keeps answering while it is re-read (no second wait).
  const known = fresh ?? savedCountryCache.get(token);
  return known ? { done: true, country: known.country } : { done: false, country: null };
}

/**
 * Destination country the cart quote is made for (ISO2, or null when
 * unknown); `done` is false while a logged-in marketplace shopper's saved
 * address is still being read. The classic checkout pre-selects the same
 * country, so its shipping and total start equal to the cart's.
 *
 * MARKETPLACE stores only (the platform is the VAT registrant): the
 * logged-in shopper's saved address country wins, then the tax country
 * comes before the store language (an EUR + English influencer store is
 * not quoted for the United Kingdom); the quote waits for that one read.
 * INDEPENDENT stores (Namez) keep the plain mirror of kustom-checkout
 * `defaultCountry`, so the cart and the Kustom checkout start on the same
 * country and no extra request delays their quote.
 */
export function useDefaultQuoteCountry(): { done: boolean; country: string | null } {
  const { token } = useAuth();
  const { currency } = useCart();
  const market = useMarket();
  const primaryLocale = useStorePrimaryLocale();
  const storeTax = useStoreTax();
  const marketplace = storeTax?.registrant === 'PLATFORM';
  const saved = useSavedCountry(marketplace ? token : null);
  if (!saved.done) return { done: false, country: null };
  return {
    done: true,
    country: defaultQuoteCountry(
      market?.countries,
      currency,
      primaryLocale,
      marketplace ? storeTax?.country : null,
      marketplace ? saved.country : null,
    ),
  };
}

export function useCartQuote(): CartQuoteState {
  const locale = useLocale();
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = (params?.storeSlug as string | undefined) || '';
  const { token } = useAuth();
  const {
    items, loading, coupon, currency, storeId, marketKey, marketPreview, hasUnavailableItems,
  } = useCart();
  const { isCompany } = useBuyerType();
  const saved = useDefaultQuoteCountry();
  const countryCode = saved.country;
  const isLoggedIn = Boolean(token);
  // Lines travel as the serialised key so the effect depends on their
  // content (quantities, variants), not on the array identity. A logged-in
  // quote still re-runs on a line change: the server cart changed with it.
  const linesKey = JSON.stringify(toKustomCartLines(items));
  const couponCode = coupon?.code ?? null;
  const empty = items.length === 0;
  const canQuote = Boolean(storeId && countryCode && !loading && !empty && !hasUnavailableItems);
  // Every input of the request; a settled answer is only shown for its own key.
  const requestKey = canQuote
    ? JSON.stringify([storeId, marketKey ?? '', marketPreview, linesKey, countryCode, couponCode, locale, isCompany, isLoggedIn, currency])
    : '';

  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!requestKey || !storeId || !countryCode) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const body = buildCartQuoteBody({
        storeId,
        marketKey,
        marketPreview,
        lines: isLoggedIn ? null : JSON.parse(linesKey),
        countryCode,
        couponCode,
        locale,
        isCompany,
      });
      api<unknown>('/orders/quote', {
        method: 'POST',
        token: token ?? undefined,
        // Owner viewer token: the API quotes a non-LIVE store for its owner.
        headers: checkoutViewerHeaders(storeSlug, {
          editHintToken: readEditHintToken(),
          sessionToken: readStoredAccessToken(),
        }),
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!cancelled) setSettled({ key: requestKey, quote: normalizeCartQuote(res, currency), couponRejected: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // The coupon breaks the provider-cost floor (marketplace): keep the
          // code so the cart can say so, and re-quote without the coupon so
          // the shown figures are what the order would charge.
          const rejected = couponCode ? couponBelowCostCode(err) : null;
          if (!rejected) {
            // Any other failure (invalid coupon for this cart, personalization,
            // throttling, network) falls back to "calculated at checkout".
            setSettled({ key: requestKey, quote: null, couponRejected: null });
            return;
          }
          api<unknown>('/orders/quote', {
            method: 'POST',
            token: token ?? undefined,
            headers: checkoutViewerHeaders(storeSlug, {
              editHintToken: readEditHintToken(),
              sessionToken: readStoredAccessToken(),
            }),
            body: JSON.stringify({ ...body, coupon_code: undefined }),
          })
            .then((res) => {
              if (!cancelled) setSettled({ key: requestKey, quote: normalizeCartQuote(res, currency), couponRejected: rejected });
            })
            .catch(() => {
              if (!cancelled) setSettled({ key: requestKey, quote: null, couponRejected: rejected });
            });
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // requestKey covers every other input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (loading || empty) return { status: 'idle', countryCode, quote: null, couponRejected: null };
  // Waiting for the saved address country of a logged-in shopper.
  if (!saved.done) return { status: 'loading', countryCode, quote: null, couponRejected: null };
  if (!canQuote || !countryCode) return { status: 'unknown', countryCode, quote: null, couponRejected: null };
  if (!settled || settled.key !== requestKey) return { status: 'loading', countryCode, quote: null, couponRejected: null };
  return settled.quote
    ? { status: 'ready', countryCode, quote: settled.quote, couponRejected: settled.couponRejected }
    : { status: 'unknown', countryCode, quote: null, couponRejected: settled.couponRejected };
}
