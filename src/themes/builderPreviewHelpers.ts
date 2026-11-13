// Pure helpers for the builder preview (BuilderPreviewClient).
//
// The preview receives the page's sections as one flat list; nested sections
// point at their layout container through `parent_id`. These helpers look
// sections up in that flat list so selection, the toolbar and inline editing
// work the same at any nesting depth.

import { normalizeStoreApps, type StorefrontApps } from '@/lib/storeApps';
import { normalizeStoreTax, type StoreTaxConfig } from '@/lib/tax';
import type { ProductContext, SectionInstance } from './types';

/** Strip everything that is not safe inside a CSS attribute selector. */
export function safeSectionId(id: string | null | undefined): string | null {
  if (!id) return null;
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || null;
}

/** Find a section anywhere in the flat list (root or nested). */
export function findSection(
  sections: readonly SectionInstance[],
  id: string | null | undefined,
): SectionInstance | null {
  if (!id) return null;
  return sections.find((s) => s.id === id) ?? null;
}

/**
 * Id of the section's parent container, or null for a root section. A
 * dangling `parent_id` (parent not in the list) also yields null so the
 * preview never offers to select something that does not exist.
 */
export function findParentId(
  sections: readonly SectionInstance[],
  id: string | null | undefined,
): string | null {
  const section = findSection(sections, id);
  const parentId = section?.parent_id ?? null;
  if (!parentId || parentId === section?.id) return null;
  return findSection(sections, parentId) ? parentId : null;
}

/**
 * Hover affordance: a dashed outline on the innermost hovered section only,
 * so hovering a block inside a container does not also outline the container.
 */
export const HOVER_CSS = `
[data-section-id] { cursor: pointer; transition: outline-color 120ms ease, box-shadow 120ms ease; outline: 1px dashed transparent; outline-offset: -1px; }
[data-section-id]:hover:not(:has([data-section-id]:hover)) { outline-color: rgba(99, 102, 241, 0.55); }
`;

/**
 * Selection outline: solid frame on the selected section and, when it sits in
 * a container, a dashed frame on that parent container. Returns '' when
 * nothing (valid) is selected.
 */
export function selectionCss(selectedId: string | null | undefined, parentId?: string | null): string {
  const sel = safeSectionId(selectedId);
  if (!sel) return '';
  let css = `
[data-section-id="${sel}"],
[data-section-id="${sel}"]:hover {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
  box-shadow: inset 0 0 0 2px rgba(99, 102, 241, 0.12), 0 0 0 3px rgba(99, 102, 241, 0.18);
  border-radius: 2px;
}`;
  const parent = safeSectionId(parentId);
  if (parent && parent !== sel) {
    css += `
[data-section-id="${parent}"],
[data-section-id="${parent}"]:hover {
  outline: 2px dashed rgba(99, 102, 241, 0.7);
  outline-offset: -2px;
}`;
  }
  return css;
}

/** The section's content row for the active locale (primary, then first, as fallback). */
export function resolveSectionContent(
  sections: readonly SectionInstance[],
  sectionId: string,
  locale: string,
  primaryLocale: string,
): Record<string, unknown> | null {
  const section = findSection(sections, sectionId);
  if (!section) return null;
  const rows = Array.isArray(section.translations) ? section.translations : [];
  return (
    rows.find((r) => r.locale === locale)?.content ??
    rows.find((r) => r.locale === primaryLocale)?.content ??
    rows[0]?.content ??
    null
  );
}

/**
 * Path of the content field whose text equals `text`: a top-level string
 * (`[key]`) or a string inside a repeater item (`[key, index, subKey]`).
 */
export function findEditablePath(
  content: Record<string, unknown>,
  text: string,
): (string | number)[] | null {
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string' && value.trim() && value.trim() === text) return [key];
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!item || typeof item !== 'object') continue;
        for (const [subKey, subValue] of Object.entries(item as Record<string, unknown>)) {
          if (typeof subValue === 'string' && subValue.trim() && subValue.trim() === text) {
            return [key, i, subKey];
          }
        }
      }
    }
  }
  return null;
}

/**
 * Product the preview renders after an UPDATE_SECTIONS message: the product
 * the builder posted (read with the owner's token) when it is an object with
 * an id, else the current one (the route's server-side sample, or none).
 */
export function adoptPreviewProduct(
  posted: unknown,
  current: ProductContext | undefined,
): ProductContext | undefined {
  if (
    posted &&
    typeof posted === 'object' &&
    !Array.isArray(posted) &&
    typeof (posted as { id?: unknown }).id === 'string' &&
    (posted as { id: string }).id
  ) {
    return posted as ProductContext;
  }
  return current;
}

/**
 * The currency the preview prices in after an UPDATE_SECTIONS message. The
 * route reads the store anonymously, and a store that is not LIVE answers
 * with its "coming soon" shell (no currency), so the route fell back to EUR.
 * The dashboard posts the store's real currency read with the owner's token;
 * only a three-letter ISO-4217 code is adopted (upper-cased), anything else
 * keeps the current one. For a LIVE store both are the same code.
 */
export function adoptPreviewCurrency(posted: unknown, current: string | undefined): string | undefined {
  if (typeof posted !== 'string') return current;
  const code = posted.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : current;
}

/**
 * The store apps the preview gates on after an UPDATE_SECTIONS message. Like
 * the currency, the route's anonymous read of a store that is not LIVE gets
 * the "coming soon" shell (`apps: {}`), so the personalization app stayed off
 * in the editor; the dashboard posts the owner's read. Absent (not an
 * object) keeps the current apps. The current object is kept when the posted
 * apps normalize to the same value, so providers do not re-render on every
 * message.
 */
export function adoptPreviewApps(posted: unknown, current: StorefrontApps | undefined): StorefrontApps | undefined {
  if (!posted || typeof posted !== 'object' || Array.isArray(posted)) return current;
  const next = normalizeStoreApps(posted);
  return current && JSON.stringify(current) === JSON.stringify(next) ? current : next;
}

/**
 * The store tax settings after an UPDATE_SECTIONS message (owner read; a
 * store that is not LIVE has none in the route's read). `undefined` = not
 * posted, keep the current; `null` = the store sent none.
 */
export function adoptPreviewTax(
  posted: unknown,
  current: StoreTaxConfig | null | undefined,
): StoreTaxConfig | null | undefined {
  if (posted === undefined) return current;
  const next = normalizeStoreTax(posted);
  return JSON.stringify(current ?? null) === JSON.stringify(next) ? current : next;
}

/** The store's legacy brand colours (`store.theme`), as the live layout reads them. */
export interface PreviewStoreBrand {
  primaryColor?: string;
  secondaryColor?: string;
}

// A plain colour value only (it is written into a style attribute / CSS rule).
const BRAND_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\)|[a-z]{3,20})$/i;

function brandColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v && BRAND_COLOR.test(v) ? v : undefined;
}

/**
 * The brand colours after an UPDATE_SECTIONS message: the `theme` block of the
 * owner's read of the store (a store that is not LIVE answers the route's
 * anonymous read with its "coming soon" shell, without it). Absent or not an
 * object keeps the current value; unsafe colour values are dropped.
 */
export function adoptPreviewBrand(posted: unknown, current: PreviewStoreBrand | undefined): PreviewStoreBrand | undefined {
  if (!posted || typeof posted !== 'object' || Array.isArray(posted)) return current;
  const raw = posted as Record<string, unknown>;
  const next: PreviewStoreBrand = {};
  const primary = brandColor(raw.primaryColor);
  const secondary = brandColor(raw.secondaryColor);
  if (primary) next.primaryColor = primary;
  if (secondary) next.secondaryColor = secondary;
  return current && JSON.stringify(current) === JSON.stringify(next) ? current : next;
}

/**
 * The legacy `--store-*` colour variables the product markup reads (selected
 * thumbnail border, add-to-cart fill...), resolved like the live store
 * layout: an explicit store colour wins, otherwise the theme's tokens. The
 * preview defined none, so a draft store's preview fell back to the
 * hard-coded blue of `var(--store-primary, #2563eb)`.
 */
export function previewBrandVars(
  brand: PreviewStoreBrand | undefined,
  tokens: { primary: string; secondary: string },
  primaryContrast: (primary: string) => string,
): Record<string, string> {
  const primary = brandColor(brand?.primaryColor) ?? tokens.primary;
  const secondary = brandColor(brand?.secondaryColor) ?? tokens.secondary;
  return {
    '--store-primary': primary,
    '--store-primary-contrast': primaryContrast(primary),
    '--store-secondary': secondary,
  };
}
