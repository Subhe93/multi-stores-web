// Trader identity details (SPEC §1 `Store.trader_details`): the legal data
// an online seller must show (e-handelslagen 8 §, distansavtalslagen
// 2 kap. 2 §). Rendered in the store footer and substituted into legal
// page content as `{{trader.*}}` placeholders.

export interface TraderDetails {
  legal_name?: string | null;
  business_type?: 'company' | 'private' | string | null;
  org_number?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  /** ISO 3166-1 alpha-2. */
  country?: string | null;
  phone?: string | null;
  support_email?: string | null;
  completed_at?: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** True when the payload carries at least one displayable trader field. */
export function hasTraderDetails(td: TraderDetails | null | undefined): td is TraderDetails {
  if (!td || typeof td !== 'object') return false;
  return Boolean(
    text(td.legal_name) || text(td.org_number) || text(td.address_line1) || text(td.support_email) || text(td.phone),
  );
}

/** Address as display lines: street line(s), then "postal code city", then country. */
export function traderAddressLines(td: TraderDetails): string[] {
  const lines: string[] = [];
  if (text(td.address_line1)) lines.push(text(td.address_line1));
  if (text(td.address_line2)) lines.push(text(td.address_line2));
  const cityLine = [text(td.postal_code), text(td.city)].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (text(td.country)) lines.push(text(td.country).toUpperCase());
  return lines;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** Only these placeholders are ever substituted; anything else is left as is. */
const TRADER_PLACEHOLDER_RE = /\{\{\s*trader\.(legal_name|org_number|vat_number|address|email|phone)\s*\}\}/g;

/**
 * Replaces `{{trader.legal_name}}`, `{{trader.org_number}}`,
 * `{{trader.vat_number}}`, `{{trader.address}}`, `{{trader.email}}` and
 * `{{trader.phone}}` in an HTML string with the store's trader details.
 * Values are HTML-escaped; the address joins its lines with ", ". Without
 * trader details every placeholder becomes an empty string so the raw
 * braces never reach a visitor.
 */
export function substituteTraderPlaceholders(html: string, td: TraderDetails | null | undefined): string {
  if (!html || !html.includes('{{')) return html;
  const details = td && typeof td === 'object' ? td : null;
  return html.replace(TRADER_PLACEHOLDER_RE, (_match, key: string) => {
    if (!details) return '';
    switch (key) {
      case 'legal_name':
        return escapeHtml(text(details.legal_name));
      case 'org_number':
        return escapeHtml(text(details.org_number));
      case 'vat_number':
        return escapeHtml(text(details.vat_number));
      case 'address':
        return escapeHtml(traderAddressLines(details).join(', '));
      case 'email':
        return escapeHtml(text(details.support_email));
      case 'phone':
        return escapeHtml(text(details.phone));
      default:
        return '';
    }
  });
}
