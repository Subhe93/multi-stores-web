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
  /** Set on `seller_details` when the platform operator is the seller (MARKETPLACE). */
  is_platform?: boolean | null;
  /** Platform brand name sent with a platform seller (e.g. "ShopsDoor"). */
  platform_brand?: string | null;
}

/** Store payload fields that carry the seller identity. */
export interface SellerSource {
  /** Seller of record from the API: the platform for MARKETPLACE stores. */
  seller_details?: TraderDetails | null;
  /** The store's own trader details (legacy payloads without seller_details). */
  trader_details?: TraderDetails | null;
}

/**
 * The seller identity a storefront shows: `seller_details` (the platform
 * operator on MARKETPLACE stores) with `trader_details` as the fallback for
 * API payloads that predate it.
 */
export function sellerDetailsOf(store: SellerSource | null | undefined): TraderDetails | null {
  if (!store) return null;
  return store.seller_details ?? store.trader_details ?? null;
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

/**
 * Swedish org numbers / personnummer as written officially: "NNNNNN-NNNN"
 * (12 digits: "YYYYMMDD-NNNN"). Applied when the country is SE or unknown;
 * anything that is not a plain Swedish digit string is returned trimmed.
 */
export function formatOrgNumber(org: string | null | undefined, country?: string | null): string {
  const raw = text(org);
  if (!raw) return '';
  const cc = text(country).toUpperCase();
  if (cc && cc !== 'SE') return raw;
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return raw;
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  if (digits.length === 12) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  return raw;
}

/** Country name in `locale` for an ISO2 code; the upper-cased code otherwise. */
function countryName(code: string, locale?: string): string {
  const cc = code.toUpperCase();
  if (!locale || !/^[A-Z]{2}$/.test(cc)) return cc;
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(cc) || cc;
  } catch {
    return cc;
  }
}

/**
 * Address as display lines: street line(s), then "postal code city", then
 * country (its name in `locale` when given, else the ISO2 code).
 */
export function traderAddressLines(td: TraderDetails, locale?: string): string[] {
  const lines: string[] = [];
  if (text(td.address_line1)) lines.push(text(td.address_line1));
  if (text(td.address_line2)) lines.push(text(td.address_line2));
  const cityLine = [text(td.postal_code), text(td.city)].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (text(td.country)) lines.push(countryName(text(td.country), locale));
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
