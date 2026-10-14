// ── b2b app settings (plans/namez-store-apps/M2-DESIGN.md D6 / §4.1) ─────────
// The API exposes the app's settings on `storefront.getStore(...).apps.b2b
// .settings` (registry `expose_settings_to_storefront`). This is the lenient
// read mirror of the API's `parseB2bSettings`: unknown / malformed values
// fall back to the defaults so the storefront never throws on a bad payload.
//
// Pure module (no React, no `next/*`) — shared by the server layout, client
// hooks and vitest.

export type ApiBuyerType = 'PERSON' | 'COMPANY';

export interface B2bSettings {
  /** False hides the toggle and forces every shopper into the person view. */
  allow_company: boolean;
  /** View a first-time visitor (no cookie) starts in. */
  default_buyer_type: ApiBuyerType;
  /** Company checkout must provide a VAT number. */
  require_vat_number: boolean;
  /** ISO2 countries whose organisation-number format is validated strictly. */
  org_number_countries: string[];
}

export const DEFAULT_B2B_SETTINGS: B2bSettings = {
  allow_company: true,
  default_buyer_type: 'PERSON',
  require_vat_number: false,
  org_number_countries: ['SE'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Coerce `apps.b2b.settings`; every field falls back to its default. */
export function normalizeB2bSettings(raw: unknown): B2bSettings {
  if (!isPlainObject(raw)) return { ...DEFAULT_B2B_SETTINGS, org_number_countries: [...DEFAULT_B2B_SETTINGS.org_number_countries] };
  const countries = Array.isArray(raw.org_number_countries)
    ? raw.org_number_countries
        .filter((c): c is string => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c.trim()))
        .map((c) => c.trim().toUpperCase())
    : null;
  return {
    allow_company: raw.allow_company !== false,
    default_buyer_type: raw.default_buyer_type === 'COMPANY' ? 'COMPANY' : 'PERSON',
    require_vat_number: raw.require_vat_number === true,
    org_number_countries: countries ?? [...DEFAULT_B2B_SETTINGS.org_number_countries],
  };
}
