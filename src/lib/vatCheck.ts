// ── VAT-number check (b2b app, plans/namez-store-apps/M2.5-DESIGN.md §5) ─────
// State machine + message mapping of the checkout's VAT field when the store
// has reverse charge on. The browser only *shows* the outcome of
// `POST /storefront/:slug/b2b/vat-check`; whether an order is exempt is
// decided server-side on every quote / order (D8), never from this state.
//
// Pure module (no React, no `next/*`) — vitest covered.

import { normalizeVatNumber, validateVatNumber } from './b2bValidators';

export type VatCheckState =
  | 'idle'
  | 'checking'
  | 'valid'
  | 'invalid'
  | 'unavailable'
  | 'format_invalid'
  | 'not_eu';

/** `why` of a "no reverse charge" decision (API `reverse-charge.ts`). */
export type ReverseChargeWhy =
  | 'APP_OFF'
  | 'PERSON'
  | 'MARKETPLACE'
  | 'SELLER_NOT_EU'
  | 'DESTINATION_NOT_EU'
  | 'SAME_COUNTRY'
  | 'VAT_COUNTRY_IS_SELLER'
  | 'NO_VAT'
  | 'VAT_INVALID'
  | 'VAT_UNAVAILABLE'
  /** Quote without a destination country: no decision yet. */
  | 'NO_DESTINATION'
  /** 409 only: the customer has a full exemption instead of reverse charge. */
  | 'CUSTOMER_EXEMPT';

const WHYS: readonly ReverseChargeWhy[] = [
  'APP_OFF', 'PERSON', 'MARKETPLACE', 'SELLER_NOT_EU', 'DESTINATION_NOT_EU',
  'SAME_COUNTRY', 'VAT_COUNTRY_IS_SELLER', 'NO_VAT', 'VAT_INVALID', 'VAT_UNAVAILABLE', 'NO_DESTINATION', 'CUSTOMER_EXEMPT',
];

export function normalizeWhy(raw: unknown): ReverseChargeWhy | null {
  return typeof raw === 'string' && (WHYS as readonly string[]).includes(raw) ? (raw as ReverseChargeWhy) : null;
}

/** Settled outcome of one check (or of the local format check). */
export interface VatCheckResult {
  state: VatCheckState;
  /** Normalised number the result belongs to. */
  vatNumber: string;
  /** Destination the decision was made for; null = none sent. */
  countryCode: string | null;
  /** VIES company name (valid numbers only). */
  name: string | null;
  checkedAt: string | null;
  /** null = no decision (no destination, or reverse charge off). */
  reverseCharge: boolean | null;
  why: ReverseChargeWhy | null;
}

/**
 * Coerce the vat-check response. Returns null for `status: 'disabled'` (app
 * or reverse charge off) or a malformed body — the field then stays silent.
 */
export function normalizeVatCheckResponse(raw: unknown, requested: { vatNumber: string; countryCode: string | null }): VatCheckResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const status = r.status;
  let state: VatCheckState;
  switch (status) {
    case 'valid':
    case 'invalid':
    case 'unavailable':
    case 'format_invalid':
    case 'not_eu':
      state = status;
      break;
    case 'disabled':
      return null;
    default:
      // Unknown status / error codes (e.g. QUEUE_TIMEOUT) fail closed.
      if (typeof status !== 'string') return null;
      state = 'unavailable';
  }
  return {
    state,
    vatNumber: typeof r.vat_number === 'string' && r.vat_number ? r.vat_number : requested.vatNumber,
    countryCode: typeof r.country_code === 'string' && r.country_code ? r.country_code : requested.countryCode,
    name: state === 'valid' && typeof r.name === 'string' && r.name.trim() ? r.name.trim() : null,
    checkedAt: typeof r.checked_at === 'string' ? r.checked_at : null,
    reverseCharge: typeof r.reverse_charge === 'boolean' ? r.reverse_charge : null,
    why: normalizeWhy(r.why),
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────
// `key` = normalised number + destination; results for an older key are
// dropped so a slow response never overwrites a newer input.

export interface VatCheckModel {
  key: string | null;
  state: VatCheckState;
  result: VatCheckResult | null;
}

export type VatCheckAction =
  | { type: 'reset' }
  | { type: 'format_invalid'; key: string; vatNumber: string; countryCode: string | null }
  | { type: 'start'; key: string }
  | { type: 'result'; key: string; result: VatCheckResult | null }
  | { type: 'failed'; key: string; vatNumber: string; countryCode: string | null };

export const INITIAL_VAT_CHECK: VatCheckModel = { key: null, state: 'idle', result: null };

/**
 * Comparable form of a VAT number: normalised, with Greece in its VIES
 * form (`GR…` → `EL…`) so a number typed with the ISO prefix matches the
 * validated / quoted one. Use on BOTH sides of every comparison.
 */
export function vatComparable(raw: string | null | undefined): string {
  const v = normalizeVatNumber(raw ?? '');
  return v.startsWith('GR') ? `EL${v.slice(2)}` : v;
}

export function vatCheckKey(vatNumber: string, countryCode: string | null | undefined): string {
  return `${normalizeVatNumber(vatNumber)}|${(countryCode || '').toUpperCase()}`;
}

/** Local result when the request itself failed: fail-closed, VAT applies. */
function unavailableResult(vatNumber: string, countryCode: string | null): VatCheckResult {
  return { state: 'unavailable', vatNumber, countryCode, name: null, checkedAt: null, reverseCharge: countryCode ? false : null, why: 'VAT_UNAVAILABLE' };
}

export function vatCheckReducer(model: VatCheckModel, action: VatCheckAction): VatCheckModel {
  switch (action.type) {
    case 'reset':
      return INITIAL_VAT_CHECK;
    case 'format_invalid':
      return {
        key: action.key,
        state: 'format_invalid',
        result: {
          state: 'format_invalid', vatNumber: action.vatNumber, countryCode: action.countryCode,
          name: null, checkedAt: null, reverseCharge: action.countryCode ? false : null, why: 'VAT_INVALID',
        },
      };
    case 'start':
      return { key: action.key, state: 'checking', result: null };
    case 'result':
      if (action.key !== model.key) return model;
      // A null result = reverse charge off server-side: say nothing.
      return action.result ? { key: action.key, state: action.result.state, result: action.result } : { key: action.key, state: 'idle', result: null };
    case 'failed': {
      if (action.key !== model.key) return model;
      const result = unavailableResult(action.vatNumber, action.countryCode);
      return { key: action.key, state: 'unavailable', result };
    }
    default:
      return model;
  }
}

/** Local pre-check: the number to send to the API, or a format verdict. */
export function precheckVat(raw: string): { kind: 'empty' } | { kind: 'format_invalid'; vatNumber: string } | { kind: 'ok'; vatNumber: string } {
  const vatNumber = normalizeVatNumber(raw);
  if (!vatNumber) return { kind: 'empty' };
  if (validateVatNumber(vatNumber) !== null) return { kind: 'format_invalid', vatNumber };
  return { kind: 'ok', vatNumber };
}

// ── Messages ─────────────────────────────────────────────────────────────────

export type VatMessageTone = 'muted' | 'success' | 'neutral' | 'error' | 'warning';

/** Reasons that have their own "valid, but VAT applies" sentence. */
const NO_RC_WHY_KEYS: Partial<Record<ReverseChargeWhy, string>> = {
  SAME_COUNTRY: 'b2b.vat.validNoReverseCharge.SAME_COUNTRY',
  DESTINATION_NOT_EU: 'b2b.vat.validNoReverseCharge.DESTINATION_NOT_EU',
  VAT_COUNTRY_IS_SELLER: 'b2b.vat.validNoReverseCharge.VAT_COUNTRY_IS_SELLER',
};

/**
 * i18n key + tone for a state; null = nothing to show. `reverseCharge` /
 * `why` refine a valid result (with a destination the server decided).
 */
export function vatCheckMessageKey(
  state: VatCheckState,
  reverseCharge: boolean | null,
  why: ReverseChargeWhy | null,
): { key: string; tone: VatMessageTone } | null {
  switch (state) {
    case 'idle':
      return null;
    case 'checking':
      return { key: 'b2b.vat.checking', tone: 'muted' };
    case 'valid':
      if (reverseCharge === true) return { key: 'b2b.vat.reverseCharge', tone: 'success' };
      // No destination yet = no decision: just "valid".
      if (reverseCharge === false && why !== 'NO_DESTINATION') {
        return { key: (why && NO_RC_WHY_KEYS[why]) || 'b2b.vat.validNoReverseCharge.DEFAULT', tone: 'neutral' };
      }
      return { key: 'b2b.vat.valid', tone: 'neutral' };
    case 'invalid':
      return { key: 'b2b.vat.invalid', tone: 'error' };
    case 'format_invalid':
      return { key: 'b2b.vat.formatInvalid', tone: 'error' };
    case 'not_eu':
      return { key: 'b2b.vat.notEu', tone: 'neutral' };
    case 'unavailable':
      return { key: 'b2b.vat.unavailable', tone: 'warning' };
    default:
      return null;
  }
}

// ── Session memory for the cart hint ─────────────────────────────────────────
// After a check said "reverse charge applies" in this browser session, the
// cart (which cannot know the outcome) shows a short hint. Display only.

const RC_HINT_PREFIX = 'ms-rc-hint:';

export function rememberReverseChargeHint(storeSlug: string, applies: boolean): void {
  if (!storeSlug) return;
  try {
    if (applies) sessionStorage.setItem(RC_HINT_PREFIX + storeSlug, '1');
    else sessionStorage.removeItem(RC_HINT_PREFIX + storeSlug);
  } catch {
    /* storage unavailable: the hint is optional */
  }
}

export function readReverseChargeHint(storeSlug: string): boolean {
  if (!storeSlug) return false;
  try {
    return sessionStorage.getItem(RC_HINT_PREFIX + storeSlug) === '1';
  } catch {
    return false;
  }
}
