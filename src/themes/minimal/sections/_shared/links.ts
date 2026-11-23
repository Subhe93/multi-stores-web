import { isStoreLinkRef } from '@multi-stores/core/link-ref';
import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';
import type { LinkScope } from '@/lib/localePaths';

/** Visible keyboard focus ring for links and buttons of a section. */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Href of an owner-entered link inside a section: internal paths get the
 * link prefix of the request (a secondary locale's `/<locale>`, or on a
 * locale-path market the visited `/de-at`), external links stay untouched
 * and an empty value gives '#'. Sections pass `{ locale, primaryLocale,
 * pathPrefix }` from their props.
 */
export function sectionHref(raw: unknown, scope: LinkScope): string {
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) return '#';
  return localizeStoreUrl(url, storeLocalePrefix(scope), scope.locale);
}

/**
 * Owner-written HTML (rich text, custom HTML blocks): every internal
 * `href="/…"` gets the same link prefix as `sectionHref`, so a visitor on
 * `/de-at` (or `/ar`) stays there when following a link in the text.
 * External, protocol-relative, hash-only and mailto/tel links are untouched.
 * An unresolved `product:<id>` reference (M165 safety net) becomes the
 * prefixed product list.
 */
export function sectionHtml(html: string | undefined | null, scope: LinkScope): string {
  if (!html) return '';
  const prefix = storeLocalePrefix(scope);
  const out = /\shref\s*=\s*["']\s*(product|collection|page):/i.test(html)
    ? html.replace(/(\shref\s*=\s*)(["'])([^"']*)\2/gi, (whole, attr: string, quote: string, url: string) =>
        isStoreLinkRef(url) ? `${attr}${quote}/products${quote}` : whole,
      )
    : html;
  if (!prefix) return out;
  return out.replace(
    /(\shref\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,
    (_m, attr: string, quote: string, url: string) =>
      `${attr}${quote}${localizeStoreUrl(url, prefix, scope.locale)}${quote}`,
  );
}
