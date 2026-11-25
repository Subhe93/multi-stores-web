// Variant URLs (M170 B): `?variant=<ProductVariant.id>` on a product URL
// preselects that variant on the server render, and the page keeps the
// parameter in step with the shopper's selection. The id is the variant
// uuid: the same value the Google feed uses as `g:id`.
//
// The canonical of a product page never carries the parameter (one page,
// one canonical), so variant URLs do not create duplicate pages.
//
// Pure functions, no `next/*` import: used by the server route, the JSON-LD
// builder and the client state.

export const VARIANT_QUERY_PARAM = 'variant';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The variant a `?variant=` value selects, or undefined. Accepted: one
 * string (a repeated parameter is ignored), uuid-shaped after trim and
 * lower-casing, naming an active variant of the rendered product. Anything
 * else is ignored (the base page renders; never a 404).
 */
export function variantFromQuery(
  value: string | string[] | undefined,
  variants: readonly { id: string; is_active?: boolean | null }[] | null | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim().toLowerCase();
  if (!UUID.test(id)) return undefined;
  const match = (variants ?? []).find((v) => v && v.id === id && v.is_active !== false);
  return match ? match.id : undefined;
}

/**
 * The query string as the personalization URL prefill may read it: every
 * `variant` entry with a uuid-shaped value is removed. Such a value is a
 * variant link (feed, JSON-LD offer url, the page's own URL sync), never a
 * personalization value, so a store whose `url_prefill` has an alias named
 * `variant` does not get the raw id typed into a field. Any other value of
 * that alias keeps working. A uuid that names no variant of the product
 * (stale link) is dropped as well.
 */
export function withoutVariantLinkParam(search: string | URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search).entries()) {
    if (key === VARIANT_QUERY_PARAM && UUID.test(value.trim().toLowerCase())) continue;
    out.append(key, value);
  }
  return out;
}

/** URL that preselects a variant. `canonical` has no query and no hash. */
export function variantUrl(canonical: string, id: string): string {
  return `${canonical}?${VARIANT_QUERY_PARAM}=${id}`;
}

/**
 * Client: sets (or with undefined removes) `?variant=` on the current URL
 * without a navigation, a scroll or a server round trip. Every other
 * parameter and the hash are kept; nothing is written when the URL already
 * says the same. The `null` state goes through the app router's patched
 * `replaceState`, which keeps the router's own history state.
 */
export function writeVariantParam(id: string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.getAll(VARIANT_QUERY_PARAM);
    if (id ? current.length === 1 && current[0] === id : current.length === 0) return;
    if (id) url.searchParams.set(VARIANT_QUERY_PARAM, id);
    else url.searchParams.delete(VARIANT_QUERY_PARAM);
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Not fatal: the address bar simply keeps the previous URL.
  }
}
