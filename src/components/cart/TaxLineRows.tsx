'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/format';
import { taxLineLabel, type TaxLine } from '@/lib/tax';

/**
 * Row label of a tax line: the API's "Moms 25 %" form, or — for the 0 % row
 * of an exempt order (b2b app M2.5) — "VAT 0 % — Reverse charge" /
 * "VAT 0 % — Tax exempt" in the storefront language.
 */
export function useTaxLineLabel(): (line: TaxLine) => string {
  const t = useTranslations('b2b');
  return useCallback(
    (line: TaxLine) => {
      if (line.exempt_reason === 'REVERSE_CHARGE') return t('reverseChargeRow');
      if (line.exempt_reason === 'CUSTOMER_EXEMPT') return t('customerExemptRow');
      return taxLineLabel(line);
    },
    [t],
  );
}

// ── Itemized tax rows ─────────────────────────────────────────────────────────
// One row per (label, rate) group, e.g. "Moms 25 %   55 kr". The label comes
// from the API already localized. Shared by the cart, checkout and receipts:
//   - INCLUSIVE stores render them muted under the total ("included");
//   - EXCLUSIVE stores render them as regular rows that add to the total.

interface TaxLineRowsProps {
  lines: TaxLine[];
  currency: string;
  locale?: string;
  /** `muted`: small grey rows (tax already included); `row`: regular price rows. */
  variant?: 'muted' | 'row';
  /** Custom formatter (receipts use their own Intl instance). */
  format?: (amount: number) => string;
}

export function TaxLineRows({ lines, currency, locale = 'en', variant = 'row', format }: TaxLineRowsProps) {
  const label = useTaxLineLabel();
  if (lines.length === 0) return null;
  const fmt = format ?? ((amount: number) => formatPrice(amount, currency, locale));
  const rowCls = variant === 'muted'
    ? 'flex justify-between text-xs text-gray-500'
    : 'flex justify-between text-sm py-1';
  const labelCls = variant === 'muted' ? '' : 'text-gray-600';
  const amountCls = variant === 'muted' ? '' : 'text-gray-900 font-medium';
  return (
    <>
      {lines.map((line, i) => (
        <div key={`${line.label}-${line.rate_bp}-${i}`} className={rowCls}>
          <span className={labelCls}>{label(line)}</span>
          <span className={amountCls}>{fmt(line.tax_amount)}</span>
        </div>
      ))}
    </>
  );
}
