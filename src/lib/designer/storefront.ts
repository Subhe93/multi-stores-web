// ── Designer app: tiny storefront helpers (M4.2) ──────────────────────────
// Kept free of the renderer so product pages without a design template do
// not ship it (the light `DesignerSession` module and the cart import from here).

/**
 * Custom shop button label of `shop_button_text` (an I18n map): the exact
 * locale, else the store's primary locale, else '' (the caller then uses the
 * translated default). Never another language's text.
 */
export function pickButtonText(raw: unknown, locale: string, primaryLocale?: string): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const map = raw as Record<string, unknown>;
  for (const key of [locale, primaryLocale]) {
    const v = key ? map[key] : undefined;
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/**
 * Edit link of a designer cart line: the product page by slug when known
 * (works in any browser), else the path recorded when the design was
 * created in this browser; null when neither is known.
 */
export function designEditHref(
  designId: string,
  productSlug: string | null | undefined,
  storedPath: string | null,
  localePath: (p: string) => string,
): string | null {
  const base = productSlug ? localePath(`/products/${encodeURIComponent(productSlug)}`) : storedPath;
  return base ? `${base}?design=${encodeURIComponent(designId)}` : null;
}

/** Query parameter that opens an existing design inline (cart "Edit design"). */
export const DESIGN_QUERY_PARAM = 'design';

/** The design id of `?design=<uuid>` on the current URL, or null. */
export function readDesignParam(): string | null {
  if (typeof window === 'undefined') return null;
  const v = new URL(window.location.href).searchParams.get(DESIGN_QUERY_PARAM);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/**
 * Removes `?design=` from the current history entry: a reload keeps the
 * draft, not the link. The entry is replaced in place, so "back" still leaves
 * the page. A null state goes through the app router's patched
 * `replaceState`, which keeps its own tree and syncs its URL (passing the
 * router's state would bypass that and the next router update could put
 * the parameter back).
 */
export function dropDesignParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DESIGN_QUERY_PARAM)) return;
  url.searchParams.delete(DESIGN_QUERY_PARAM);
  try {
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Not fatal: the link simply stays in the address bar.
  }
}
