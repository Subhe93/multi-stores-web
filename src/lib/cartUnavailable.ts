// Deleted / unavailable products in the cart (fix batch 1, item 5).
//
// Quote, order creation, Stripe create-intent and the Kustom session answer
// `409 { code: 'CART_ITEMS_UNAVAILABLE', unavailable: [{ product_id?,
// variant_id?, custom_product_id? }] }` when a line's product / variant was
// deleted, archived, unpublished or belongs to another store. The cart drops
// those lines and tells the shopper. Pure helpers only.

/** API error code of a cart that holds lines that can no longer be bought. */
export const CART_ITEMS_UNAVAILABLE_CODE = 'CART_ITEMS_UNAVAILABLE';

/** One entry of the error's `unavailable` list. */
export interface UnavailableRef {
  product_id?: string;
  variant_id?: string;
  custom_product_id?: string;
}

/** The cart line fields the matcher reads (guest and server lines). */
export interface UnavailableLineLike {
  productId: string;
  variantId?: string | null;
  customProductId?: string | null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** Normalised `unavailable` entries; entries without any id are dropped. */
export function normalizeUnavailable(raw: unknown): UnavailableRef[] {
  if (!Array.isArray(raw)) return [];
  const out: UnavailableRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const ref: UnavailableRef = {
      ...(str(e.product_id) ? { product_id: str(e.product_id) } : {}),
      ...(str(e.variant_id) ? { variant_id: str(e.variant_id) } : {}),
      ...(str(e.custom_product_id) ? { custom_product_id: str(e.custom_product_id) } : {}),
    };
    if (ref.product_id || ref.variant_id || ref.custom_product_id) out.push(ref);
  }
  return out;
}

/**
 * The `unavailable` list of a `CART_ITEMS_UNAVAILABLE` error; null for any
 * other error (an empty list still counts: the cart is re-read / re-quoted).
 */
export function readUnavailableError(err: unknown): UnavailableRef[] | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { code?: unknown; unavailable?: unknown };
  if (e.code !== CART_ITEMS_UNAVAILABLE_CODE) return null;
  return normalizeUnavailable(e.unavailable);
}

/**
 * True when the line is the one an entry names. A custom product matches on
 * its id; a variant entry matches the line of that variant (and of that
 * product when the entry names one); a product-only entry matches every line
 * of the product (a deleted product takes all its variants with it).
 */
export function lineMatchesUnavailable(line: UnavailableLineLike, ref: UnavailableRef): boolean {
  const customId = line.customProductId || null;
  if (ref.custom_product_id) return customId === ref.custom_product_id;
  if (customId) return false;
  if (ref.variant_id) {
    if ((line.variantId || null) !== ref.variant_id) return false;
    return !ref.product_id || line.productId === ref.product_id;
  }
  return !!ref.product_id && line.productId === ref.product_id;
}

/** Lines the entries name (kept in cart order). */
export function unavailableLines<T extends UnavailableLineLike>(items: readonly T[], refs: readonly UnavailableRef[]): T[] {
  if (refs.length === 0) return [];
  return items.filter((line) => refs.some((ref) => lineMatchesUnavailable(line, ref)));
}

/** The cart without the lines the entries name. */
export function withoutUnavailable<T extends UnavailableLineLike>(items: readonly T[], refs: readonly UnavailableRef[]): T[] {
  if (refs.length === 0) return [...items];
  return items.filter((line) => !refs.some((ref) => lineMatchesUnavailable(line, ref)));
}

/** Stable key of an entry (dedupes the same entry reported twice). */
export function unavailableRefKey(ref: UnavailableRef): string {
  return `${ref.product_id ?? ''}|${ref.variant_id ?? ''}|${ref.custom_product_id ?? ''}`;
}
