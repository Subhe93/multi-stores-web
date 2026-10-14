'use client';

import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';

// ── Company snapshot of an order (b2b app, M2-DESIGN §4.5) ───────────────────
// Rendered on the receipt and the account order page whenever the order was
// placed as a company — keyed on the order snapshot, never on the current
// buyer-type cookie or the app state: a receipt reflects how it was bought.

export interface CompanySnapshotLike {
  customer_type?: 'PERSON' | 'COMPANY' | string | null;
  company_name?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
  buyer_reference?: string | null;
}

export function isCompanyOrder(order: CompanySnapshotLike | null | undefined): boolean {
  return order?.customer_type === 'COMPANY';
}

interface CompanyBlockProps {
  order: CompanySnapshotLike | null | undefined;
  /** `card` adds the rounded surface used on the account pages. */
  variant?: 'card' | 'plain';
  className?: string;
}

export function CompanyBlock({ order, variant = 'card', className = '' }: CompanyBlockProps) {
  const t = useTranslations('b2b');
  if (!isCompanyOrder(order)) return null;
  const rows: { label: string; value: string }[] = [
    { label: t('companyName'), value: order?.company_name?.trim() || '' },
    { label: t('orgNumber'), value: order?.org_number?.trim() || '' },
    { label: t('vatNumber'), value: order?.vat_number?.trim() || '' },
    { label: t('reference'), value: order?.buyer_reference?.trim() || '' },
  ].filter((r) => r.value);

  const body = (
    <>
      <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-gray-500" />
        {t('companyDetails')}
      </h2>
      <dl className="text-sm text-gray-600 space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="text-gray-500 shrink-0">{r.label}:</dt>
            <dd className="text-gray-800 min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  if (variant === 'plain') return <div className={className}>{body}</div>;
  return <div className={`store-surface store-bd rounded-2xl border p-5 ${className}`}>{body}</div>;
}
