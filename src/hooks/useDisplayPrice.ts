'use client';

import { useCallback } from 'react';
import { useStoreTax } from '@/hooks/useStoreTax';
import { useBuyerType } from '@/hooks/useBuyerType';
import { displayPrice, type DisplayPriceResult } from '@/lib/b2bPrice';

// ── Display price (b2b app, M2-DESIGN §4.3) ──────────────────────────────────
// `const price = useDisplayPrice(); price(gross, product.tax_rate_bp)` →
// the amount to format plus the suffix / "+VAT" hint, combining the store's
// tax settings with the current buyer type. For a person (and for every
// store without the app) the amount is returned unchanged.

export type DisplayPriceFn = (amount: number, taxRateBp?: number | null, currency?: string) => DisplayPriceResult;

export function useDisplayPrice(): DisplayPriceFn {
  const tax = useStoreTax();
  const { isCompany } = useBuyerType();
  const pricingMode = tax?.pricing_mode ?? 'INCLUSIVE';
  const displayInclTax = tax ? tax.display_prices_incl_tax : false;
  return useCallback<DisplayPriceFn>(
    (amount, taxRateBp, currency) =>
      displayPrice({ amount, taxRateBp, pricingMode, displayInclTax, isCompany, currency }),
    [pricingMode, displayInclTax, isCompany],
  );
}
