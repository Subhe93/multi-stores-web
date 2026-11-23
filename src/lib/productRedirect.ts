// Permanent redirect of a product page to its canonical slug (M164 part 1).
//
// A product resolves by any of its translated slugs, so `/de-de/products/<sv
// slug>` renders the product with a canonical pointing at the German slug.
// This module decides the single hop that replaces that hint with a rule:
// the target is exactly the slug `productAlternates` puts in the canonical
// (same helper, `productCanonicalSlug`), so the redirected URL is a fixed
// point and the rule cannot loop.
//
// Pure functions only: no `next/*`, imported by vitest.

import { productCanonicalSlug, type ProductAlternatesStore, type ProductSlugTranslation } from './productPaths';
import { decodeRouteParam, isUsableSlug, routeSlug, slugsEqual } from './slugRoute';

/**
 * Stored slug of the translation the request matched (any locale), or the
 * normalized request slug when none matches (payload filtered by locale).
 * Canonical / JSON-LD URLs use it, so they never echo a mis-cased request.
 */
export function matchedProductSlug(
  product: { translations?: readonly ProductSlugTranslation[] | null } | null | undefined,
  requested: string,
): string {
  return product?.translations?.find((tr) => tr.slug && slugsEqual(tr.slug, requested))?.slug ?? requested;
}

/**
 * Slug to permanently redirect a product request to, or null to render it.
 *
 *  - `allowLocaleRedirect: false` (previews, review locales, focused stores):
 *    only the letter-case / Unicode-form rule (`isNonCanonicalSlugForm`).
 *  - `allowLocaleRedirect: true`: the canonical slug of the rendered locale /
 *    market. Stores without a market are self-canonical, so the result is the
 *    case rule there too.
 *
 * Never redirects towards a slug the payload did not confirm, towards a
 * degenerate slug, towards a stored slug holding `%xx` octets (the rebuilt
 * URL would decode back and loop) or to the slug already requested.
 */
export function productRedirectSlug(opts: {
  /** Route param as Next hands it (percent-encoded). */
  rawSlug: string;
  translations: readonly ProductSlugTranslation[] | null | undefined;
  store: ProductAlternatesStore | null | undefined;
  locale: string;
  allowLocaleRedirect: boolean;
  /** The proxy's noindex verdict (same input as productAlternates). */
  noindex?: boolean;
}): string | null {
  const matched = matchedProductSlug({ translations: opts.translations }, routeSlug(opts.rawSlug));
  const storedMatch = (opts.translations ?? []).some((tr) => tr.slug === matched);
  if (!storedMatch) return null;
  const target = opts.allowLocaleRedirect
    ? productCanonicalSlug({
        store: opts.store,
        translations: opts.translations,
        matchedSlug: matched,
        locale: opts.locale,
        noindex: opts.noindex,
      })
    : matched;
  // productCanonicalSlug only returns usable slugs or `matched`; a degenerate
  // matched slug has no letter-case variants, so nothing to redirect.
  if (!isUsableSlug(target)) return null;
  if (decodeRouteParam(target) !== target) return null;
  if (decodeRouteParam(opts.rawSlug) === target) return null;
  return target;
}
