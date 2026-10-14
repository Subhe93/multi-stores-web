'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buyerCookieString, readBuyerCookie, type BuyerType } from '@/lib/buyerType';
import { DEFAULT_B2B_SETTINGS, type B2bSettings } from '@/lib/b2bSettings';

// ── Buyer type context (b2b app, M2-DESIGN §4.1) ─────────────────────────────
// Person vs company view of the storefront. Seeded by the store layout from
// the `ms-buyer-type` cookie (server), switched by <BuyerTypeToggle>, read by
// every price / summary component through `useBuyerType()`.
//
// Outside the app (`enabled` false, or no provider) the hook always reports
// `isCompany: false` and `setBuyerType` is a no-op, so every price path takes
// today's branch and no cookie is ever written for non-b2b stores (§9.9).

export interface BuyerTypeContextValue {
  buyerType: BuyerType;
  isCompany: boolean;
  setBuyerType: (value: BuyerType) => void;
  /** The store has the b2b app enabled. */
  enabled: boolean;
  settings: B2bSettings;
}

const noop = () => {};
const DISABLED: BuyerTypeContextValue = {
  buyerType: 'person',
  isCompany: false,
  setBuyerType: noop,
  enabled: false,
  settings: DEFAULT_B2B_SETTINGS,
};

const BuyerTypeContext = createContext<BuyerTypeContextValue>(DISABLED);

export function BuyerTypeProvider({
  initial = 'person',
  enabled = false,
  settings,
  children,
}: {
  /** Value resolved on the server from the cookie / settings default. */
  initial?: BuyerType;
  enabled?: boolean;
  settings?: B2bSettings | null;
  children: ReactNode;
}) {
  const resolvedSettings = settings ?? DEFAULT_B2B_SETTINGS;
  const allowCompany = enabled && resolvedSettings.allow_company !== false;
  // Explicit choice made through the toggle during this page lifetime; null
  // until then (the server-resolved `initial` / the profile seed applies).
  const [choice, setChoice] = useState<BuyerType | null>(null);
  // Whether a cookie existed when the page mounted (null on the server).
  const [cookieAtMount] = useState<BuyerType | null>(() =>
    typeof document === 'undefined' ? null : readBuyerCookie(document.cookie),
  );
  const { user } = useAuth();

  // L9: a logged-in customer whose account defaults to COMPANY starts in the
  // company view when no cookie had been set — derived, never overriding an
  // explicit choice; the effect below only persists it to the cookie.
  const seedCompany =
    enabled && allowCompany && cookieAtMount === null && user?.customer?.customer_type === 'COMPANY';

  const setBuyerType = useCallback(
    (value: BuyerType) => {
      if (!enabled) return;
      const next: BuyerType = value === 'company' && allowCompany ? 'company' : 'person';
      setChoice(next);
      try {
        document.cookie = buyerCookieString(next);
      } catch {
        /* cookie writes can fail in sandboxed contexts; the state still switched */
      }
    },
    [enabled, allowCompany],
  );

  useEffect(() => {
    if (!seedCompany || choice !== null) return;
    try {
      document.cookie = buyerCookieString('company');
    } catch {
      /* ignore */
    }
  }, [seedCompany, choice]);

  const value = useMemo<BuyerTypeContextValue>(() => {
    if (!enabled) return DISABLED;
    const resolved: BuyerType = choice ?? (seedCompany ? 'company' : initial);
    const isCompany = resolved === 'company' && allowCompany;
    return {
      buyerType: isCompany ? 'company' : 'person',
      isCompany,
      setBuyerType,
      enabled: true,
      settings: resolvedSettings,
    };
  }, [enabled, choice, seedCompany, initial, allowCompany, setBuyerType, resolvedSettings]);

  return <BuyerTypeContext.Provider value={value}>{children}</BuyerTypeContext.Provider>;
}

/** Current buyer type; `isCompany` is always false without the b2b app. */
export function useBuyerType(): BuyerTypeContextValue {
  return useContext(BuyerTypeContext);
}
