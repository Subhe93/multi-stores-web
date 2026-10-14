'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, FileText, Loader2, RotateCw } from 'lucide-react';
import { useApiError } from '@/lib/useApiError';
import { downloadAuthed } from '@/lib/download';
import {
  fetchOrderInvoices,
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceFilename,
  invoicePdfPath,
  signedGross,
  type InvoiceSummary,
} from '@/lib/invoices';

/**
 * Invoices and credit notes of one order on the customer's account page.
 *
 * Rendered whenever the order has documents, independent of the invoices
 * app state: issued invoices stay readable after the app is disabled
 * (M3-DESIGN L1). Stores without invoices get an empty list (or a 404) and
 * the component renders nothing. Order emails link here with `#invoices`.
 */
export function OrderInvoices({ orderId }: { orderId: string }) {
  const t = useTranslations('account.invoices');
  const locale = useLocale();
  const apiError = useApiError();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<InvoiceSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_access_token');
    if (!token || !orderId) return;
    let cancelled = false;
    setLoadFailed(false);
    fetchOrderInvoices(orderId, token)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => {
        // Stay silent on failure (most orders have no invoices) unless the
        // customer arrived from an invoice email, where a visible error with
        // a retry is better than a missing section.
        if (!cancelled && window.location.hash === '#invoices') setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [orderId, reloadKey]);

  const hasItems = !!items && items.length > 0;

  // Deep link from the order email: the section mounts after the fetch, so
  // the browser's own hash scroll has already missed it.
  useEffect(() => {
    if (!hasItems && !loadFailed) return;
    const scrollIfHash = () => {
      if (window.location.hash === '#invoices') {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    scrollIfHash();
    window.addEventListener('hashchange', scrollIfHash);
    return () => window.removeEventListener('hashchange', scrollIfHash);
  }, [hasItems, loadFailed]);

  if (loadFailed) {
    return (
      <div id="invoices" ref={sectionRef} className="store-surface store-bd rounded-2xl border p-5 scroll-mt-24">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-sm text-gray-500">{t('loadFailed')}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  const handleDownload = async (inv: InvoiceSummary) => {
    const token = localStorage.getItem('auth_access_token');
    if (!token) return;
    setBusyId(inv.id);
    setRowError(null);
    try {
      await downloadAuthed(invoicePdfPath(inv.id), token, invoiceFilename(inv));
    } catch (err) {
      const e = err as { status?: number; code?: string };
      const message = e.status === 503 || e.code === 'INVOICE_PDF_UNAVAILABLE'
        ? t('pdfUnavailable')
        : apiError(err);
      setRowError({ id: inv.id, message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div id="invoices" ref={sectionRef} className="store-surface store-bd rounded-2xl border p-5 scroll-mt-24">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('title')}</h2>
      <div className="divide-y divide-gray-100">
        {items.map((inv) => {
          const isCredit = inv.kind === 'CREDIT_NOTE';
          const busy = busyId === inv.id;
          return (
            <div key={inv.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        isCredit ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {isCredit ? t('creditNote') : t('invoice')}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      <span className="sr-only">{t('number')} </span>
                      <bdi dir="ltr">{inv.number}</bdi>
                    </span>
                    {!isCredit && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.paid ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.paid ? t('paid') : t('unpaid')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="sr-only">{t('date')} </span>
                    <bdi dir="ltr">{formatInvoiceDate(inv.issue_date, locale)}</bdi>
                    {isCredit && inv.credited_invoice?.number && (
                      <>
                        {' · '}
                        <bdi dir="ltr">{inv.credited_invoice.number}</bdi>
                      </>
                    )}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${isCredit ? 'text-red-600' : 'text-gray-900'}`}>
                  <span className="sr-only">{t('amount')} </span>
                  <bdi dir="ltr">{formatInvoiceAmount(signedGross(inv), inv.currency, locale)}</bdi>
                </span>
                {inv.pdf_available !== false && (
                <button
                  type="button"
                  onClick={() => handleDownload(inv)}
                  disabled={busy}
                  aria-busy={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {busy ? t('downloading') : t('download')}
                </button>
                )}
              </div>
              {rowError?.id === inv.id && (
                <p className="text-xs text-red-600 mt-1.5" role="alert">{rowError.message}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
