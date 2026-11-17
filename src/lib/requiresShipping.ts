// ── Products that need no shipping (services / digital products) ─────────────
// The single place the storefront decides whether a product, a cart line, a
// cart or an order requires shipping (Shopify "Physical product" off). No
// other file reads `requires_shipping` / `requiresShipping` to decide
// anything; copying the value into a payload or a line is fine.
//
// Rule everywhere: only the literal `false` switches shipping off. A missing,
// null or true value means "requires shipping", so an older API, a cached
// payload or a stored guest cart keeps today's behaviour.
//
// The flag is per product today. A later per-variant override only has to put
// the variant's value in the add-to-cart metadata (see `ProductPageState`):
// every reader below already works per line.

/** Anything carrying the API flag (product payload, order, order item, quote). */
export interface ShippingFlagSource {
  requires_shipping?: boolean | null;
}

/** A cart line: the flag is kept only when the line needs no shipping. */
export interface ShippingFlagLine {
  requiresShipping?: boolean | null;
}

/** Product payload (own or custom product). */
export function productRequiresShipping(product: ShippingFlagSource | null | undefined): boolean {
  return product?.requires_shipping !== false;
}

/**
 * Promotions to show on a product page: a product without shipping never
 * advertises free shipping. Returns the same array for every other product.
 */
export function promotionsForProduct<P extends { type?: string | null }>(
  product: ShippingFlagSource | null | undefined,
  promotions: readonly P[] | null | undefined,
): readonly P[] {
  const list = promotions ?? [];
  if (productRequiresShipping(product)) return list;
  return list.filter((promo) => promo.type !== 'FREE_SHIPPING');
}

/** Cart line (`useCart` item, server or guest). */
export function lineRequiresShipping(line: ShippingFlagLine | null | undefined): boolean {
  return line?.requiresShipping !== false;
}

/** The lines shipping is quoted for. */
export function shippableLines<T extends ShippingFlagLine>(lines: readonly T[]): T[] {
  return lines.filter((line) => lineRequiresShipping(line));
}

/**
 * A cart requires shipping when any line does. The server quote (POST
 * /orders/quote, the Kustom session totals, the shipping estimate) is
 * authoritative when there is one: a guest line can carry a stale flag. An
 * empty cart requires shipping (nothing is hidden for it).
 */
export function cartRequiresShipping(
  lines: readonly ShippingFlagLine[],
  quote?: ShippingFlagSource | null,
): boolean {
  if (quote) return quote.requires_shipping !== false;
  if (lines.length === 0) return true;
  return lines.some((line) => lineRequiresShipping(line));
}

/**
 * Server answer the checkout decides with (the `quote` argument of
 * `cartRequiresShipping` / `shippingQuoteLines`). The order quote when there
 * is one. Before the first quote answers, null: the cart lines decide. When
 * the quote was asked and FAILED, the line flags alone are not trusted (a
 * stored guest line can carry a stale `requiresShipping: false` while the
 * order is still created with shipping): the checkout keeps its shipping
 * step, every line goes to the shipping estimate, and the estimate (which
 * filters by product on the server) may then answer that nothing ships.
 */
export function checkoutShippingVerdict(
  quote: ShippingFlagSource | null | undefined,
  opts: { quoteFailed: boolean; estimateSaysNoShipping: boolean },
): ShippingFlagSource | null {
  if (quote) return quote;
  if (!opts.quoteFailed) return null;
  return { requires_shipping: !opts.estimateSaysNoShipping };
}

/**
 * Lines sent to the shipping endpoints (`product_ids`, `item_count`): none
 * for a cart without shipping, the shippable lines otherwise. When the quote
 * says the cart ships but no line is flagged shippable (stale guest flags),
 * every line is sent and the API filters by product.
 */
export function shippingQuoteLines<T extends ShippingFlagLine>(
  lines: readonly T[],
  quote?: ShippingFlagSource | null,
): T[] {
  if (!cartRequiresShipping(lines, quote)) return [];
  const shippable = shippableLines(lines);
  return shippable.length > 0 ? shippable : [...lines];
}

/** Order snapshot (written at purchase time; orders before the column read true). */
export function orderRequiresShipping(order: ShippingFlagSource | null | undefined): boolean {
  return order?.requires_shipping !== false;
}

/** Order line snapshot (Shopify `line_item.requires_shipping`). */
export function orderLineRequiresShipping(item: ShippingFlagSource | null | undefined): boolean {
  return item?.requires_shipping !== false;
}

// Mirrors the OrderStatus progression on the API. Manufacturing and quality
// check are real stages a fulfiller can set.
const SHIPPING_TRACKER_STEPS = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'MANUFACTURING',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
] as const;

// An order without shipping has no production or transit stage to show.
const NO_SHIPPING_TRACKER_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'DELIVERED'] as const;

/** Steps of the account order tracker (stored status values). */
export function orderTrackerSteps(order: ShippingFlagSource | null | undefined): readonly string[] {
  return orderRequiresShipping(order) ? SHIPPING_TRACKER_STEPS : NO_SHIPPING_TRACKER_STEPS;
}

/**
 * Index of the current step in `orderTrackerSteps(order)`. An order without
 * shipping shows a stored MANUFACTURING, QUALITY_CHECK or SHIPPED at the
 * PROCESSING step. An unknown status falls back to the first step (a -1 would
 * blank the whole tracker).
 */
export function orderTrackerIndex(
  status: string | null | undefined,
  order: ShippingFlagSource | null | undefined,
): number {
  const steps = orderTrackerSteps(order);
  const s = (status ?? '').toUpperCase();
  const idx = steps.indexOf(s);
  if (idx >= 0) return idx;
  if (!orderRequiresShipping(order) && (s === 'MANUFACTURING' || s === 'QUALITY_CHECK' || s === 'SHIPPED')) {
    return steps.indexOf('PROCESSING');
  }
  return 0;
}

/**
 * Message key of a status label. On an order without shipping DELIVERED
 * reads "Completed" (`orderStatus.FULFILLED`), and a stored MANUFACTURING,
 * QUALITY_CHECK or SHIPPED (bulk action, API client) reads "Processing",
 * the step the tracker shows for it: such an order is never "Shipped" to
 * the buyer. Everything else is unchanged.
 */
export function orderStatusLabelKey(
  status: string | null | undefined,
  order: ShippingFlagSource | null | undefined,
): string {
  if (!orderRequiresShipping(order)) {
    const s = (status ?? '').toUpperCase();
    if (s === 'DELIVERED') return 'orderStatus.FULFILLED';
    if (s === 'MANUFACTURING' || s === 'QUALITY_CHECK' || s === 'SHIPPED') {
      return 'orderStatus.PROCESSING';
    }
  }
  return `orderStatus.${status}`;
}

/** Reads the API flag of a server payload: `false` only for the literal false. */
export function readRequiresShippingFlag(raw: unknown): boolean {
  return raw !== false;
}
