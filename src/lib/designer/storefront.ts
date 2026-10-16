// ── Designer app: tiny storefront helpers (M4.2) ──────────────────────────
// Kept free of the renderer so product pages without a design template do
// not ship it (DesignerLauncher imports from here).

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
