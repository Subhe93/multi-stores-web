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
import { toKustomCartLines } from '@/hooks/useKustomCheckout';
import { checkoutViewerHeaders } from '@/lib/storePreview';
import { readEditHintToken } from '@/components/edit-hint/editHintStorage';
import {
  QUOTE_DEBOUNCE_MS,
  buildCartQuoteBody,
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
  | { status: 'idle'; countryCode: string | null; quote: null }
  | { status: 'loading'; countryCode: string; quote: null }
  /** The real figures for `countryCode`. */
  | { status: 'ready'; countryCode: string; quote: CartQuote }
  /** No usable quote (error, shipping unavailable, no default country, blocked cart). */
  | { status: 'unknown'; countryCode: string | null; quote: null };

interface Settled {
  key: string;
  quote: CartQuote | null;
}

export function useCartQuote(): CartQuoteState {
  const locale = useLocale();
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = (params?.storeSlug as string | undefined) || '';
  const { token } = useAuth();
  const {
    items, loading, coupon, currency, storeId, marketKey, marketPreview, hasUnavailableItems,
  } = useCart();
  const market = useMarket();
  const { isCompany } = useBuyerType();
  const primaryLocale = useStorePrimaryLocale();

  const countryCode = defaultQuoteCountry(market?.countries, currency, primaryLocale);
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
          if (!cancelled) setSettled({ key: requestKey, quote: normalizeCartQuote(res, currency) });
        })
        .catch(() => {
          // Any failure (invalid coupon for this cart, personalization,
          // throttling, network) falls back to "calculated at checkout".
          if (!cancelled) setSettled({ key: requestKey, quote: null });
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // requestKey covers every other input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (loading || empty) return { status: 'idle', countryCode, quote: null };
  if (!canQuote || !countryCode) return { status: 'unknown', countryCode, quote: null };
  if (!settled || settled.key !== requestKey) return { status: 'loading', countryCode, quote: null };
  return settled.quote
    ? { status: 'ready', countryCode, quote: settled.quote }
    : { status: 'unknown', countryCode, quote: null };
}
