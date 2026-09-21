'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useStoreTax } from '@/hooks/useStoreTax';

// ── Price tax suffix ──────────────────────────────────────────────────────────
// Small muted "incl. VAT" / "excl. VAT" next to catalog prices, driven by the
// store's tax settings (API-CONTRACT-TAX §4):
//   INCLUSIVE + display_prices_incl_tax  → "incl. VAT"
//   EXCLUSIVE                            → "excl. VAT" (prices are net)
// Renders nothing outside a StoreProviders tree or when the store hides it.

interface PriceTaxSuffixProps {
  className?: string;
  style?: CSSProperties;
}

export function PriceTaxSuffix({ className = 'text-xs text-gray-500', style }: PriceTaxSuffixProps) {
  const t = useTranslations('product');
  const tax = useStoreTax();
  if (!tax) return null;
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
