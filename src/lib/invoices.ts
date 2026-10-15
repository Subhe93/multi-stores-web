import { api } from './api';

// Mirrors the API `InvoiceSummary` contract (M3-DESIGN §9).
export type InvoiceKind = 'INVOICE' | 'CREDIT_NOTE';

export interface InvoiceSummary {
  id: string;
  kind: InvoiceKind;
  number: string;
  /** Calendar date (YYYY-MM-DD) in the seller's timezone. */
  issue_date: string;
  due_date: string | null;
  order_id: string;
  order_number: string;
  currency: string;
  net_total: number;
  vat_total: number;
  /** Negative for credit notes. */
  gross_total: number;
  paid: boolean;
  buyer_name: string | null;
  buyer_type: 'COMPANY' | 'PERSON' | null;
  credited_invoice: { id: string; number: string } | null;
  trigger: string | null;
  reason: string | null;
  pdf_available: boolean;
  /** INVOICE only. */
  remaining_creditable?: number;
  /** Tax exemption recorded at issue time; null on taxed documents. */
  tax_exempt_reason?: 'REVERSE_CHARGE' | 'CUSTOMER_EXEMPT' | null;
  buyer_vat_number?: string | null;
  buyer_country?: string | null;
}

/**
 * Invoices and credit notes of one order for the signed-in customer.
 * A 404 (foreign order / nothing to show) resolves to an empty list so the
 * caller can simply render nothing.
 */
export async function fetchOrderInvoices(orderId: string, token: string): Promise<InvoiceSummary[]> {
  try {
    const list = await api<InvoiceSummary[] | null>(
      `/invoices/documents/orders/${encodeURIComponent(orderId)}`,
      { token, cache: 'no-store' },
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

/** PDF endpoint path for one document. */
export function invoicePdfPath(id: string): string {
  return `/invoices/documents/${encodeURIComponent(id)}/pdf`;
}

/** Safe download filename, e.g. `INV-1001.pdf` (path separators stripped). */
export function invoiceFilename(summary: Pick<InvoiceSummary, 'number' | 'id'>): string {
  const base = (summary.number || summary.id).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
  return `${base || 'invoice'}.pdf`;
}

/** Gross amount with the sign a customer expects: credit notes are always negative. */
export function signedGross(summary: Pick<InvoiceSummary, 'kind' | 'gross_total'>): number {
  const value = Number(summary.gross_total) || 0;
  return summary.kind === 'CREDIT_NOTE' ? -Math.abs(value) : value;
}

/** Amount formatted in the invoice currency with Latin digits (M3 L6). */
export function formatInvoiceAmount(amount: number, currency: string, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(`${locale}-u-nu-latn`, { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Formats a YYYY-MM-DD calendar date without shifting it through UTC. */
export function formatInvoiceDate(date: string, locale = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  try {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return m[0];
  }
}
