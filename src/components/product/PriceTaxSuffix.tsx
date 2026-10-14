'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useStoreTax } from '@/hooks/useStoreTax';
import { useBuyerType } from '@/hooks/useBuyerType';
import { isKnownRate } from '@/lib/b2bPrice';
import { formatTaxRate } from '@/lib/tax';

// ── Price tax suffix ──────────────────────────────────────────────────────────
// Small muted "incl. VAT" / "excl. VAT" next to catalog prices, driven by the
// store's tax settings (API-CONTRACT-TAX §4):
//   INCLUSIVE + display_prices_incl_tax  → "incl. VAT"
//   EXCLUSIVE                            → "excl. VAT" (prices are net)
// Renders nothing outside a StoreProviders tree or when the store hides it.
//
// Company view (b2b app, M2-DESIGN §4.3): "excl. VAT" plus, when the line's
// estimated rate is known, a second muted "+25 % VAT". With an unknown rate
// the amount next to it is still gross, so the person suffix is kept.

interface PriceTaxSuffixProps {
  className?: string;
  style?: CSSProperties;
  /** Estimated rate of the priced product / line (b2b stores only). */
  taxRateBp?: number | null;
}

export function PriceTaxSuffix({ className = 'text-xs text-gray-500', style, taxRateBp }: PriceTaxSuffixProps) {
  const t = useTranslations('product');
  const tB2b = useTranslations('b2b');
  const tax = useStoreTax();
  const { isCompany } = useBuyerType();
  if (!tax) return null;

  const companyNet = isCompany && (tax.pricing_mode === 'EXCLUSIVE' || isKnownRate(taxRateBp));
  if (companyNet) {
    return (
      <span className={`font-normal whitespace-nowrap ${className}`} style={style}>
        {t('exclTax')}
        {isKnownRate(taxRateBp) && (
          <span className="ms-1">{tB2b('plusVat', { rate: formatTaxRate(taxRateBp) })}</span>
        )}
      </span>
    );
  }

  const label = tax.pricing_mode === 'EXCLUSIVE'
    ? t('exclTax')
    : tax.display_prices_incl_tax ? t('inclTax') : null;
  if (!label) return null;
  return (
    <span className={`font-normal whitespace-nowrap ${className}`} style={style}>
      {label}
    </span>
  );
}
