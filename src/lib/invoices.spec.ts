import { describe, expect, it } from 'vitest';
import { formatInvoiceAmount, formatInvoiceDate, invoiceFilename, invoicePdfPath, signedGross } from './invoices';
import { filenameFromContentDisposition, toDownloadError } from './download';

describe('invoiceFilename', () => {
  it('uses the document number', () => {
    expect(invoiceFilename({ id: 'x', number: 'INV-1001' })).toBe('INV-1001.pdf');
  });
  it('strips path separators and whitespace', () => {
    expect(invoiceFilename({ id: 'x', number: '2026/INV 7' })).toBe('2026_INV_7.pdf');
  });
  it('falls back to the id, then to a constant', () => {
    expect(invoiceFilename({ id: 'abc', number: '' })).toBe('abc.pdf');
    expect(invoiceFilename({ id: '', number: '///' })).toBe('invoice.pdf');
  });
});

describe('signedGross', () => {
  it('keeps invoices as-is', () => {
    expect(signedGross({ kind: 'INVOICE', gross_total: 500 })).toBe(500);
  });
  it('forces credit notes negative regardless of the stored sign', () => {
    expect(signedGross({ kind: 'CREDIT_NOTE', gross_total: -120 })).toBe(-120);
    expect(signedGross({ kind: 'CREDIT_NOTE', gross_total: 120 })).toBe(-120);
  });
});

describe('formatting', () => {
  it('formats amounts in the invoice currency with Latin digits', () => {
    expect(formatInvoiceAmount(-120, 'SEK', 'ar')).toMatch(/120/);
    expect(formatInvoiceAmount(1234.5, 'EUR', 'en')).toBe('€1,234.50');
  });
  it('formats calendar dates without a timezone shift', () => {
    expect(formatInvoiceDate('2026-10-14', 'en')).toBe('Oct 14, 2026');
    expect(formatInvoiceDate('not-a-date', 'en')).toBe('not-a-date');
  });
  it('builds the PDF path', () => {
    expect(invoicePdfPath('a b')).toBe('/invoices/documents/a%20b/pdf');
  });
});

describe('toDownloadError', () => {
  it('reads code and message from a JSON body', () => {
    const err = toDownloadError(503, JSON.stringify({ code: 'INVOICE_PDF_UNAVAILABLE', message: 'No browser' }));
    expect(err.status).toBe(503);
    expect(err.code).toBe('INVOICE_PDF_UNAVAILABLE');
    expect(err.message).toBe('No browser');
  });
  it('tolerates non-JSON bodies', () => {
    const err = toDownloadError(502, '<html>Bad gateway</html>');
    expect(err.status).toBe(502);
    expect(err.code).toBeUndefined();
    expect(err.message).toBe('Download failed');
  });
});

describe('filenameFromContentDisposition', () => {
  it('reads the quoted filename', () => {
    expect(filenameFromContentDisposition('attachment; filename="INV-1001.pdf"')).toBe('INV-1001.pdf');
  });
  it('prefers the RFC 5987 form', () => {
    expect(filenameFromContentDisposition(`attachment; filename="x.pdf"; filename*=UTF-8''Faktura%20INV-7.pdf`)).toBe('Faktura INV-7.pdf');
  });
  it('strips path separators and rejects empty names', () => {
    expect(filenameFromContentDisposition('attachment; filename="2026/INV-1.pdf"')).toBe('2026_INV-1.pdf');
    expect(filenameFromContentDisposition('attachment')).toBeNull();
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition('attachment; filename=".."')).toBeNull();
  });
});
