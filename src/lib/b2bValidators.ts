// ── Company field validators (plans/namez-store-apps/M2-DESIGN.md D7) ────────
// Format-only mirror of the API's `org-number.util.ts` / `vat-number.util.ts`
// so the checkout can show inline messages before submitting. The API is
// authoritative: its `B2B_*` error codes are mapped through `errors.*`.
// The organisation-number rules (normalisation, checksums, pretty forms) are
// a direct port of the API module — keep both in sync.
//
// Each validator returns an i18n key (plus params where the message needs
// them) on failure, or null on success — same convention as `validators.ts`.

export interface OrgNumberRule {
  /** Human-readable expected format, shown in the inline message. */
  format: string;
  /** Digits-only canonical form after stripping separators, or null. */
  normalize: (raw: string) => string | null;
  /** Checksum over the normalized digits; absent = format only. */
  checksum?: (digits: string) => boolean;
  /** Pretty form stored on the order / shown back to the shopper. */
  pretty: (digits: string) => string;
}

/** Separators accepted inside a number: whitespace, hyphen, dot. */
const digitsOnly = (raw: string) => raw.replace(/[\s\-.]/g, '');

/** Luhn mod-10 (Swedish standard): doubles every other digit from the right. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const fromRight = digits.length - 1 - i;
    let d = Number(digits[i]);
    if (fromRight % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Weighted sum of the leading digits (helper of the Nordic mod-11 checks). */
function weightedSum(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += Number(digits[i]) * weights[i]!;
  }
  return sum;
}

/** Countries with a strict organisation-number format (L7: SE, FI, DK, NO). */
export const ORG_NUMBER_RULES: Record<string, OrgNumberRule> = {
  // Sweden: NNNNNN-NNNN, Luhn over the 10 digits. The 12-digit form with a
  // "16" prefix (as in the VAT number) is accepted and reduced.
  SE: {
    format: 'NNNNNN-NNNN',
    normalize: (raw) => {
      let d = digitsOnly(raw);
      if (d.length === 12 && d.startsWith('16')) d = d.slice(2);
      return /^\d{10}$/.test(d) ? d : null;
    },
    checksum: luhnValid,
    pretty: (d) => `${d.slice(0, 6)}-${d.slice(6)}`,
  },
  // Finland: Y-tunnus NNNNNNN-N, modulus 11 with weights 7 9 10 5 8 4 2.
  FI: {
    format: 'NNNNNNN-N',
    normalize: (raw) => {
      const d = digitsOnly(raw);
      return /^\d{8}$/.test(d) ? d : null;
    },
    checksum: (d) => {
      const rem = weightedSum(d, [7, 9, 10, 5, 8, 4, 2]) % 11;
      if (rem === 1) return false;
      const check = rem === 0 ? 0 : 11 - rem;
      return check === Number(d[7]);
    },
    pretty: (d) => `${d.slice(0, 7)}-${d.slice(7)}`,
  },
  // Denmark: CVR, 8 digits, modulus 11 with weights 2 7 6 5 4 3 2 1.
  DK: {
    format: 'NNNNNNNN',
    normalize: (raw) => {
      const d = digitsOnly(raw);
      return /^\d{8}$/.test(d) ? d : null;
    },
    checksum: (d) => weightedSum(d, [2, 7, 6, 5, 4, 3, 2, 1]) % 11 === 0,
    pretty: (d) => d,
  },
  // Norway: organisasjonsnummer, 9 digits, modulus 11 with weights
  // 3 2 7 6 5 4 3 2 over the first eight. A trailing "MVA" is ignored.
  NO: {
    format: 'NNNNNNNNN',
    normalize: (raw) => {
      const d = digitsOnly(raw.replace(/MVA$/i, ''));
      return /^\d{9}$/.test(d) ? d : null;
    },
    checksum: (d) => {
      const rem = weightedSum(d, [3, 2, 7, 6, 5, 4, 3, 2]) % 11;
      const check = rem === 0 ? 0 : 11 - rem;
      if (check === 10) return false;
      return check === Number(d[8]);
    },
    pretty: (d) => d,
  },
};

/** Generic rule: 4-20 characters of letters, digits, space, dot, slash, dash. */
export const GENERIC_ORG_NUMBER_FORMAT = '4-20 characters';
const GENERIC_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,18}[A-Za-z0-9]$/;

export type OrgNumberReason = 'EMPTY' | 'FORMAT' | 'CHECKSUM';

export interface OrgNumberResult {
  ok: boolean;
  /** Canonical (pretty) form when ok, the trimmed input otherwise. */
  normalized: string;
  reason: OrgNumberReason | null;
  format: string;
  /** ISO2 of the strict rule applied, null for the generic rule. */
  country: string | null;
}

/** Full result, same shape as the API's `validateOrgNumber`. */
export function checkOrgNumber(
  country: string | null | undefined,
  raw: string | null | undefined,
  strictCountries: readonly string[] = ['SE'],
): OrgNumberResult {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  const iso = (country ?? '').trim().toUpperCase();
  const strict = strictCountries.map((c) => c.toUpperCase());
  const rule = strict.includes(iso) ? ORG_NUMBER_RULES[iso] : undefined;

  if (!trimmed) {
    return { ok: false, normalized: '', reason: 'EMPTY', format: rule?.format ?? GENERIC_ORG_NUMBER_FORMAT, country: rule ? iso : null };
  }
  if (!rule) {
    const ok = GENERIC_PATTERN.test(trimmed);
    return { ok, normalized: trimmed, reason: ok ? null : 'FORMAT', format: GENERIC_ORG_NUMBER_FORMAT, country: null };
  }
  const digits = rule.normalize(trimmed);
  if (!digits) return { ok: false, normalized: trimmed, reason: 'FORMAT', format: rule.format, country: iso };
  if (rule.checksum && !rule.checksum(digits)) {
    return { ok: false, normalized: trimmed, reason: 'CHECKSUM', format: rule.format, country: iso };
  }
  return { ok: true, normalized: rule.pretty(digits), reason: null, format: rule.format, country: iso };
}

export interface OrgNumberError {
  key: 'checkout.errors.orgNumberRequired' | 'checkout.errors.orgNumberInvalid';
  /** Expected format for the `orgNumberInvalid` message. */
  format?: string;
}

/** Expected-format hint for the input helper text. */
export function orgNumberFormatHint(country: string | null | undefined, strictCountries: readonly string[] = ['SE']): string {
  const iso = (country || '').trim().toUpperCase();
  const strict = strictCountries.map((c) => c.toUpperCase());
  return (iso && strict.includes(iso) ? ORG_NUMBER_RULES[iso]?.format : undefined) ?? GENERIC_ORG_NUMBER_FORMAT;
}

/**
 * Best-effort canonical form for the request bodies: the strict pretty form
 * when the number validates for the country, else the trimmed input.
 */
export function normalizeOrgNumber(country: string | null | undefined, raw: string, strictCountries: readonly string[] = ['SE']): string {
  return checkOrgNumber(country, raw, strictCountries).normalized;
}

/**
 * Inline-message form: only the countries listed in `strictCountries` (b2b
 * settings `org_number_countries`) get the strict rule; everything else
 * uses the generic 4-20 character rule.
 */
export function validateOrgNumber(
  country: string | null | undefined,
  raw: string,
  strictCountries: readonly string[] = ['SE'],
): OrgNumberError | null {
  const r = checkOrgNumber(country, raw, strictCountries);
  if (r.ok) return null;
  if (r.reason === 'EMPTY') return { key: 'checkout.errors.orgNumberRequired' };
  return { key: 'checkout.errors.orgNumberInvalid', format: r.format };
}

export function validateCompanyName(raw: string): 'checkout.errors.companyNameRequired' | null {
  const value = (raw ?? '').trim();
  return value.length === 0 || value.length > 200 ? 'checkout.errors.companyNameRequired' : null;
}

/** Country-prefix VAT patterns (same table as the API). */
export const VAT_PATTERNS: Record<string, RegExp> = {
  SE: /^SE\d{12}$/,
  DE: /^DE\d{9}$/,
  FI: /^FI\d{8}$/,
  DK: /^DK\d{8}$/,
  NO: /^NO\d{9}MVA$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  NL: /^NL\d{9}B\d{2}$/,
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  IT: /^IT\d{11}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  IE: /^IE(\d{7}[A-Z]{1,2}|\d[A-Z0-9+*]\d{5}[A-Z])$/,
  PL: /^PL\d{10}$/,
};

export const GENERIC_VAT_PATTERN = /^[A-Z]{2}[A-Z0-9]{2,13}$/;

/** Upper-case, no spaces / dots / hyphens — what the API stores. */
export function normalizeVatNumber(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[\s.\-]/g, '');
}

export function validateVatNumber(
  raw: string,
  required = false,
): 'checkout.errors.vatNumberRequired' | 'checkout.errors.vatNumberInvalid' | null {
  const value = normalizeVatNumber(raw);
  if (!value) return required ? 'checkout.errors.vatNumberRequired' : null;
  if (!GENERIC_VAT_PATTERN.test(value)) return 'checkout.errors.vatNumberInvalid';
  const country = value.slice(0, 2);
  const pattern = VAT_PATTERNS[country];
  if (pattern && !pattern.test(value)) return 'checkout.errors.vatNumberInvalid';
  return null;
}
