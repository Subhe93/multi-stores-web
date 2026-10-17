/**
 * Guest cart line helpers (M4.0 §1.2). Pure functions used by `useCart` so
 * the merge rules can be unit-tested without React.
 *
 * Lines merge only when product, variant, bundle offer AND personalization
 * match: `lineKey(customFields)` is '' without personalization, so carts of
 * products without custom fields merge exactly as before M4.0.
 */
// Imported from the rules module directly (not the barrel) so the cart chunk
// does not pull the M4.1 evaluator along (M5 D24).
import { lineKey, normalizeFieldValues } from '@/lib/personalization/rules';
import { isKnownRate } from '@/lib/b2bPrice';
import type { CartItem, CartItemMetadata, DesignLinePatch, DesignLineReplacement } from '@/hooks/useCart';

// ── Guest cart storage (localStorage) ────────────────────────────────────

export const GUEST_CART_KEY = 'guest_cart';
export const GUEST_COUPON_KEY = 'guest_coupon';

/** The subset of `Storage` the guest cart uses (injectable for tests). */
export interface KeyValueStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** Parses a stored guest cart; anything unreadable is an empty cart. */
export function parseStoredGuestCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Writes a value to storage without ever throwing (M5 D1): a full or
 * disabled storage (Safari private mode, quota) keeps the in-memory cart and
 * returns false instead of blanking the page. `null` removes the key.
 */
export function safeStorageWrite(storage: KeyValueStorage | null | undefined, key: string, value: string | null): boolean {
  if (!storage) return false;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The guest cart carried by a cross-tab `storage` event (M5 D12): the new
 * lines when the event is about the cart key, null for any other key.
 */
export function guestCartFromStorageEvent(event: { key: string | null; newValue: string | null }): CartItem[] | null {
  if (event.key !== GUEST_CART_KEY) return null;
  return parseStoredGuestCart(event.newValue);
}

/** Merge identity of a guest line: personalization values + design id (M4.2). */
export function guestLineKey(item: Pick<CartItem, 'customFields' | 'designId'>): string {
  return lineKey(item.customFields, item.designId ?? null);
}

/** True when two lines are the same cart line (and their quantities add up). */
type LineIdentity = Pick<CartItem, 'productId' | 'variantId' | 'bundleOfferId' | 'customFields' | 'designId'>;

export function isSameGuestLine(a: LineIdentity, b: LineIdentity): boolean {
  return (
    a.productId === b.productId &&
    (a.variantId ?? undefined) === (b.variantId ?? undefined) &&
    (a.bundleOfferId ?? null) === (b.bundleOfferId ?? null) &&
    guestLineKey(a) === guestLineKey(b)
  );
}

/** Unique local line id; the random suffix keeps same-millisecond adds apart (W9). */
export function newGuestLineId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Values stored on a guest line: normalized like the server stores them, so
 * the guest key equals the server key after login. `undefined` stays
 * `undefined` (and `{}` stays `{}`) so lines without personalization keep the
 * exact stored shape (G0).
 */
export function storedGuestFields(
  customFields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return customFields === undefined ? undefined : normalizeFieldValues(customFields);
}

/** Adds one line to a guest cart: merges into an identical line, else appends. */
export function addGuestLine(
  prev: CartItem[],
  productId: string,
  variantId: string | null,
  quantity: number,
  customFields: Record<string, unknown> | undefined,
  metadata: CartItemMetadata | undefined,
  makeId: () => string = newGuestLineId,
): CartItem[] {
  const bundleOfferId = metadata?.bundleOfferId || undefined;
  // Designer lines carry no field values (the server drops them, C29).
  const design = metadata?.design?.id ? metadata.design : undefined;
  const fields = design ? undefined : storedGuestFields(customFields);
  const idx = prev.findIndex((i) =>
    isSameGuestLine(i, {
      productId,
      variantId: variantId ?? undefined,
      bundleOfferId,
      customFields: fields,
      designId: design?.id,
    }),
  );
  if (idx >= 0) {
    return prev.map((item, i) => (i === idx ? { ...item, quantity: item.quantity + quantity } : item));
  }
  const newItem: CartItem = {
    id: makeId(),
    productId,
    variantId: variantId ?? undefined,
    customProductId: metadata?.customProductId,
    title: metadata?.title,
    price: metadata?.price ?? 0,
    quantity,
    imageUrl: metadata?.imageUrl,
    variant: metadata?.variant,
    customerFile: metadata?.customerFile,
    currency: metadata?.currency,
    customFields: fields,
    customFieldDisplay: metadata?.customFieldDisplay,
    bundleOfferId: bundleOfferId ?? null,
    bundleOriginalUnitPrice: metadata?.bundleOriginalUnitPrice ?? null,
    bundleTitle: metadata?.bundleTitle ?? null,
    bundleLabel: metadata?.bundleLabel ?? null,
    bundleStickerText: metadata?.bundleStickerText ?? null,
    bundleCartQuantity: metadata?.bundleCartQuantity ?? null,
    // b2b stores: keep the product's estimated rate on the guest line (L8);
    // omitted (not null) elsewhere so the stored shape stays identical.
    ...(isKnownRate(metadata?.taxRateBp) ? { taxRateBp: metadata!.taxRateBp } : {}),
    // Designer app (M4.2): only on designer lines, so other lines keep their shape.
    ...(design
      ? {
          designId: design.id,
          ...(design.token ? { designToken: design.token } : {}),
          design: { id: design.id, editable: true, proofUrl: design.proofUrl ?? null },
        }
      : {}),
  };
  return [...prev, newItem];
}

/**
 * Guest lines of a design after it was edited: the new text display and
 * proof (unchanged when omitted). Returns `prev` itself when no line matches.
 */
export function patchGuestDesignLine(prev: CartItem[], designId: string, patch: DesignLinePatch): CartItem[] {
  if (!prev.some((i) => i.designId === designId)) return prev;
  return prev.map((item) => {
    if (item.designId !== designId) return item;
    const design = item.design ?? { id: designId, editable: true, proofUrl: null };
    return {
      ...item,
      ...(patch.display !== undefined ? { customFieldDisplay: patch.display } : {}),
      design: patch.proofUrl !== undefined ? { ...design, proofUrl: patch.proofUrl } : design,
    };
  });
}

/**
 * Guest lines of a locked (ordered) design moved to its duplicate: same
 * product, variant, bundle and quantity, new design id / token / proof.
 * Returns `prev` itself when no line matches.
 */
export function replaceGuestDesignLine(
  prev: CartItem[],
  oldDesignId: string,
  next: DesignLineReplacement,
): CartItem[] {
  if (!prev.some((i) => i.designId === oldDesignId)) return prev;
  return prev.map((item) => {
    if (item.designId !== oldDesignId) return item;
    // The old token belongs to the ordered design: never carry it over.
    const rest: CartItem = { ...item };
    delete rest.designToken;
    return {
      ...rest,
      designId: next.id,
      ...(next.token ? { designToken: next.token } : {}),
      design: {
        id: next.id,
        editable: true,
        proofUrl: next.proofUrl ?? null,
        ...(next.productSlug ? { productSlug: next.productSlug } : {}),
      },
    };
  });
}

/**
 * Merges re-priced hand-off lines (cross-market `?c=`) into a guest cart:
 * an identical line gets the quantity added and the new price.
 */
export function mergeHandoffLines(prev: CartItem[], incoming: CartItem[]): CartItem[] {
  const next = [...prev];
  for (const item of incoming) {
    const idx = next.findIndex((i) => isSameGuestLine(i, item));
    if (idx >= 0) next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + item.quantity, price: item.price };
    else next.push(item);
  }
  return next;
}

/** Body of `POST /cart/items` for a guest line moved to the server cart on login. */
export function guestLineToServerBody(item: CartItem) {
  const isCustom = Boolean(item.customProductId);
  return {
    product_id: isCustom ? null : item.productId,
    custom_product_id: isCustom ? item.productId : undefined,
    variant_id: item.variantId || null,
    bundle_offer_id: item.bundleOfferId || undefined,
    quantity: item.quantity,
    // Designer lines: the design (and the guest token that claims it) instead
    // of field values; the token travels only in this request body.
    ...(item.designId
      ? { design_id: item.designId, ...(item.designToken ? { design_token: item.designToken } : {}) }
      : { custom_fields: item.customFields }),
  };
}

/** Error codes that make a guest line impossible to move (counted, shown in the cart). */
const MIGRATION_DROP_PREFIXES = ['CUSTOM_FIELD_', 'CUSTOMER_UPLOAD_', 'PERSONALIZATION_', 'DESIGNER_'];

/**
 * True when moving a guest line failed because of its personalization (a 4xx
 * `CUSTOM_FIELD_*`, `CUSTOMER_UPLOAD_*`, `PERSONALIZATION_*` or `DESIGNER_*`
 * error). Other failures (network, 5xx, unrelated codes) are not counted.
 */
export function isMigrationDropError(err: unknown): boolean {
  const e = err as { status?: unknown; code?: unknown } | null;
  const status = typeof e?.status === 'number' ? e.status : 0;
  const code = typeof e?.code === 'string' ? e.code : '';
  return status >= 400 && status < 500 && MIGRATION_DROP_PREFIXES.some((p) => code.startsWith(p));
}

/** A guest line the server rejected for its personalization, with the error. */
export interface DroppedGuestLine {
  item: CartItem;
  /** The coded API error (`code`, `params`, `field_name`…), for the message. */
  error: unknown;
}

/** Outcome of moving the guest cart to the server cart. */
export interface GuestMigrationResult {
  /** Lines the server accepted: these leave the local cart. */
  moved: CartItem[];
  /** Lines rejected for their personalization: kept locally and reported. */
  dropped: DroppedGuestLine[];
  /** Lines that failed for another reason (network, 5xx…): kept locally, silent. */
  failed: CartItem[];
}

/**
 * Posts every guest line to the server cart, one by one (the server merges by
 * line key) and sorts the lines into moved / dropped / failed.
 */
export async function migrateGuestLines(
  items: CartItem[],
  post: (body: ReturnType<typeof guestLineToServerBody>) => Promise<unknown>,
): Promise<GuestMigrationResult> {
  const result: GuestMigrationResult = { moved: [], dropped: [], failed: [] };
  for (const item of items) {
    try {
      await post(guestLineToServerBody(item));
      result.moved.push(item);
    } catch (err) {
      // Personalization rejections are reported; other failures stay silent as before.
      if (isMigrationDropError(err)) result.dropped.push({ item, error: err });
      else result.failed.push(item);
    }
  }
  return result;
}

/**
 * The local cart after a migration: every line except the ones that moved
 * (matched by id), so rejected lines and lines added meanwhile stay.
 */
export function remainingGuestLines(current: CartItem[], moved: CartItem[]): CartItem[] {
  if (moved.length === 0) return current;
  const movedIds = new Set(moved.map((i) => i.id));
  return current.filter((i) => !movedIds.has(i.id));
}

/** Where the guest cart lives (localStorage in `useCart`). */
export interface GuestCartStore {
  load: () => CartItem[];
  save: (items: CartItem[]) => void;
}

/**
 * Moves the stored guest cart to the server cart, one run at a time: the
 * login effect and the checkout sync can fire for the same login, and a call
 * made while a run is in flight shares that run, so no line is posted twice.
 * Nothing is cleared up front; after the run only the moved lines leave the
 * store (re-read, so lines added meanwhile stay too).
 */
export function createGuestCartMover(store: GuestCartStore) {
  let inFlight: Promise<GuestMigrationResult> | null = null;
  return (post: (body: ReturnType<typeof guestLineToServerBody>) => Promise<unknown>): Promise<GuestMigrationResult> => {
    if (inFlight) return inFlight;
    const items = store.load();
    if (items.length === 0) return Promise.resolve({ moved: [], dropped: [], failed: [] });
    const run = migrateGuestLines(items, post)
      .then((result) => {
        store.save(remainingGuestLines(store.load(), result.moved));
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
    inFlight = run;
    return run;
  };
}
