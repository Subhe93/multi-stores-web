/**
 * Guest personalization check (M4.1 D14, contract §4.5): before a personalized
 * line enters the local cart, the guest posts it to
 * `POST /storefront/:slug/personalization/validate` and keeps the
 * server-normalized values, unit price and display lines. The local cart
 * never computes a price. Pure helpers; the request itself runs in `useCart`.
 */
import { isPlainObject, type PError } from '@multi-stores/core/personalization';
import type { CartItemMetadata } from '@/hooks/useCart';
import { readApiPersonalizationErrors, type PersonalizationDisplayLine } from './model';

/** Passed with `addItem` metadata when the product uses the app form (guests only). */
export interface GuestPersonalizationCheck {
  storeSlug: string;
  locale: string;
  /** Markets app: the request market key. */
  market?: string | null;
  /** Line price from the server unit price (before bundle): applies the selected bundle. */
  linePrice?: (unitPrice: number) => number;
}

/** `ValidateBody` (§4.5). */
export interface ValidateRequestBody {
  product_id: string;
  variant_id: string | null;
  custom_fields: Record<string, unknown>;
  locale: string;
  market: string | null;
  quantity: number;
}

/** `ValidateResult` (§4.5), read leniently. */
export interface ValidateResult {
  ok: boolean;
  errors: PError[];
  custom_fields: Record<string, unknown>;
  price_delta: number;
  /** Unit price incl. the personalization delta, before any bundle; null when absent. */
  unit_price: number | null;
  currency: string | null;
  display: PersonalizationDisplayLine[];
}

export function validatePath(storeSlug: string): string {
  return `/storefront/${encodeURIComponent(storeSlug)}/personalization/validate`;
}

export function buildValidateBody(
  productId: string,
  variantId: string | null,
  quantity: number,
  customFields: Record<string, unknown> | undefined,
  check: GuestPersonalizationCheck,
): ValidateRequestBody {
  return {
    product_id: productId,
    variant_id: variantId,
    custom_fields: customFields ?? {},
    locale: check.locale,
    market: check.market ?? null,
    quantity,
  };
}

function readDisplay(raw: unknown): PersonalizationDisplayLine[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonalizationDisplayLine[] = [];
  for (const r of raw) {
    if (!isPlainObject(r) || typeof r.label !== 'string') continue;
    const line: PersonalizationDisplayLine = {
      id: typeof r.id === 'string' ? r.id : String(out.length),
      label: r.label,
      value: r.value,
      display: typeof r.display === 'string' ? r.display : null,
    };
    if (typeof r.group_key === 'string') line.group_key = r.group_key;
    if (typeof r.group_index === 'number') line.group_index = r.group_index;
    if (typeof r.group_label === 'string') line.group_label = r.group_label;
    if (typeof r.hex === 'string') line.hex = r.hex;
    if (r.source === 'FIELD' || r.source === 'OPTION') line.source = r.source;
    out.push(line);
  }
  return out;
}

/** Reads the endpoint's `data`; null when it is not a ValidateResult. */
export function readValidateResult(raw: unknown): ValidateResult | null {
  if (!isPlainObject(raw) || typeof raw.ok !== 'boolean') return null;
  const unit = Number(raw.unit_price);
  const delta = Number(raw.price_delta);
  const errors = readApiPersonalizationErrors({ code: 'PERSONALIZATION_INVALID', errors: raw.errors }) ?? [];
  return {
    ok: raw.ok && errors.length === 0,
    errors,
    custom_fields: isPlainObject(raw.custom_fields) ? raw.custom_fields : {},
    price_delta: Number.isFinite(delta) ? delta : 0,
    unit_price: raw.unit_price !== null && raw.unit_price !== undefined && Number.isFinite(unit) ? unit : null,
    currency: typeof raw.currency === 'string' ? raw.currency : null,
    display: readDisplay(raw.display),
  };
}

/** The error a rejected check throws: same shape as the API's 400, so one handler maps both. */
export function personalizationInvalidError(errors: PError[]): Error & { code: string; errors: PError[] } {
  const err = new Error('PERSONALIZATION_INVALID') as Error & { code: string; errors: PError[] };
  err.code = 'PERSONALIZATION_INVALID';
  err.errors = errors;
  return err;
}

/**
 * Guest line metadata after a successful check: the server unit price (with
 * the bundle applied by `linePrice`), the server display lines, and the
 * bundle's original unit price. The check itself is not stored.
 */
export function applyValidateResult(
  metadata: CartItemMetadata,
  result: ValidateResult,
): CartItemMetadata {
  const { personalizationCheck, ...rest } = metadata;
  const next: CartItemMetadata = { ...rest, customFieldDisplay: result.display };
  if (result.unit_price !== null) {
    next.price = personalizationCheck?.linePrice ? personalizationCheck.linePrice(result.unit_price) : result.unit_price;
    if (rest.bundleOfferId) next.bundleOriginalUnitPrice = result.unit_price;
  }
  return next;
}
