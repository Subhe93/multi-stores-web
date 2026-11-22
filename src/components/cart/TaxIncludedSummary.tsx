'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { lowerFirstLabel, type TaxLine } from '@/lib/tax';
import { TaxLineRows } from './TaxLineRows';

// ── "Incl. VAT" statement with the amount behind a toggle (M160) ─────────────
// INCLUSIVE prices for private buyers: the shopper only needs to know the
// total already contains VAT (price-display law); the rate and amount are
// one click away. Display only — the lines are formatted as received.
// Exempt rows (b2b 0 % reverse charge / customer exempt) carry a legal note
// and stay visible without a toggle.

interface TaxIncludedSummaryProps {
  lines: TaxLine[];
  currency: string;
  /** Number format locale, passed through to TaxLineRows. */
  locale?: string;
  /** Wrapper spacing from the caller. */
  className?: string;
}

export function TaxIncludedSummary({ lines, currency, locale, className }: TaxIncludedSummaryProps) {
  const t = useTranslations('cart');
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const statementId = useId();

  if (lines.length === 0) return null;

  if (lines.some((line) => line.exempt_reason)) {
    return (
      <div className={className}>
        <TaxLineRows lines={lines} currency={currency} locale={locale} variant="muted" />
      </div>
    );
  }

  // One shared API label ("MwSt.", "Moms", "VAT") → "Inkl. MwSt."; mixed labels → generic wording.
  const first = lines[0]?.label?.trim() ?? '';
  const sameLabel = first !== '' && lines.every((line) => (line.label ?? '').trim() === first);
  const statement = sameLabel
    ? t('taxIncludedStatement', { label: first, labelLower: lowerFirstLabel(first) })
    : t('taxIncludedGeneric');

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span id={statementId}>{statement}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          aria-describedby={statementId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-sm"
        >
          {t('taxDetails')}
          <ChevronDown
            aria-hidden="true"
            className={`h-3 w-3 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <div id={regionId} hidden={!open} className="mt-0.5 space-y-0.5">
        {/* The statement above already says "incl."; rows show the plain rate + amount. */}
        <TaxLineRows lines={lines} currency={currency} locale={locale} variant="muted" prefixIncluded={false} />
      </div>
    </div>
  );
}
