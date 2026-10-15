'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';

// ── Company snapshot of an order (b2b app, M2-DESIGN §4.5) ───────────────────
// Rendered on the receipt and the account order page whenever the order was
// placed as a company — keyed on the order snapshot, never on the current
// buyer-type cookie or the app state: a receipt reflects how it was bought.
// M2.5: an exempt order adds a "Reverse charge" / "Tax exempt" notice, again
// from the order's own `tax_exempt_reason` + `vat_validation`.

export interface CompanySnapshotLike {
  customer_type?: 'PERSON' | 'COMPANY' | string | null;
  company_name?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
  buyer_reference?: string | null;
  tax_exempt_reason?: 'REVERSE_CHARGE' | 'CUSTOMER_EXEMPT' | string | null;
  /** VatEvidence snapshot (M2.5-DESIGN §3.1); only a few fields are read. */
  vat_validation?: unknown;
}

export function isCompanyOrder(order: CompanySnapshotLike | null | undefined): boolean {
  return order?.customer_type === 'COMPANY';
}

/** Validated VAT number + check date of an exempt order's evidence. */
export function exemptionEvidence(order: CompanySnapshotLike | null | undefined): { vatNumber: string; checkedAt: string | null } {
  const ev = order?.vat_validation && typeof order.vat_validation === 'object'
    ? (order.vat_validation as Record<string, unknown>)
    : null;
  const evVat = typeof ev?.vat_number === 'string' ? ev.vat_number.trim() : '';
  const checkedAt = typeof ev?.checked_at === 'string' && ev.checked_at ? ev.checked_at : null;
  return { vatNumber: evVat || order?.vat_number?.trim() || '', checkedAt };
}

interface CompanyBlockProps {
  order: CompanySnapshotLike | null | undefined;
  /** `card` adds the rounded surface used on the account pages. */
  variant?: 'card' | 'plain';
  className?: string;
}

function ExemptionNotice({ order }: { order: CompanySnapshotLike }) {
  const t = useTranslations('b2b');
  const locale = useLocale();
  if (order.tax_exempt_reason === 'CUSTOMER_EXEMPT') {
    return <p className="mt-3 text-sm text-gray-700">{t('customerExemptNotice')}</p>;
  }
  if (order.tax_exempt_reason !== 'REVERSE_CHARGE') return null;
  const { vatNumber, checkedAt } = exemptionEvidence(order);
  let date: string | null = null;
  if (checkedAt) {
    const d = new Date(checkedAt);
    // UTC keeps the server and client render identical.
    if (!Number.isNaN(d.getTime())) date = d.toLocaleDateString(locale, { timeZone: 'UTC' });
  }
  return (
    <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
      <p className="font-medium">{t('reverseChargeTitle')}</p>
      <p>{t('reverseChargeNotice', { vat: vatNumber || '—' })}</p>
      {date && <p className="text-xs text-green-700">{t('vatValidatedOn', { date })}</p>}
    </div>
  );
}

export function CompanyBlock({ order, variant = 'card', className = '' }: CompanyBlockProps) {
  const t = useTranslations('b2b');
  const exempt = order?.tax_exempt_reason === 'REVERSE_CHARGE' || order?.tax_exempt_reason === 'CUSTOMER_EXEMPT';
  if (!order || (!isCompanyOrder(order) && !exempt)) return null;
  const rows: { label: string; value: string }[] = isCompanyOrder(order)
    ? [
        { label: t('companyName'), value: order.company_name?.trim() || '' },
        { label: t('orgNumber'), value: order.org_number?.trim() || '' },
        { label: t('vatNumber'), value: order.vat_number?.trim() || '' },
        { label: t('reference'), value: order.buyer_reference?.trim() || '' },
      ].filter((r) => r.value)
    : [];

  const body = (
    <>
      {isCompanyOrder(order) && (
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
      )}
      {exempt && <ExemptionNotice order={order} />}
    </>
  );

  if (variant === 'plain') return <div className={className}>{body}</div>;
  return <div className={`store-surface store-bd rounded-2xl border p-5 ${className}`}>{body}</div>;
}
