// Dynamic sources ("Shopify dynamic source") for content sections placed on a
// PRODUCT_TEMPLATE: the rich-text body and the image of image-with-text /
// single-image can show the current product's data instead of a stored value.
//
// Server-safe (no 'use client'): text sources and the featured / Nth image
// are resolved on the server from the `product` prop SectionRenderer already
// passes. Only `variant_image` needs a client island (DynamicProductImage).
//
// The source lives in `settings` (one value for every locale). A missing,
// empty or unknown value means "static": the section renders exactly as it
// did before dynamic sources existed.

import type { CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import {
  attrLabel,
  attrSwatchColor,
  findAttribute,
  formatAttrValue,
  yesNoWords,
  type ProductAttributeLike,
} from '@/lib/productSpecs';
import type { ProductContext } from '../../../types';

export {
  CONTENT_SOURCES,
  IMAGE_SOURCES,
  dynamicContentSource,
  dynamicImageSource,
  hasDynamicSource,
  type DynamicContentSource,
  type DynamicImageSource,
} from './dynamicSourceKeys';
import type { DynamicContentSource, DynamicImageSource } from './dynamicSourceKeys';

type ProductTranslation = ProductContext['translations'][number];

/**
 * The product's row for `locale`, otherwise the first row. Same rule as
 * ProductPageState, so dynamic text matches the product blocks on the page.
 */
export function pickProductTranslation(product: ProductContext | undefined | null, locale: string): ProductTranslation | null {
  const rows = product?.translations;
  if (!rows?.length) return null;
  return rows.find((t) => t.locale === locale) || rows[0];
}

export interface SpecRow {
  id: string;
  label: string;
  value: string;
  swatch: string | null;
}

export type DynamicText =
  /** HTML sanitized by the API on write (sanitizeCreatorHtml), as the product page injects it. */
  | { kind: 'html'; html: string }
  /** Plain text, always rendered as a text node. */
  | { kind: 'text'; text: string; swatch?: string | null }
  | { kind: 'specs'; rows: SpecRow[] };

function productAttributes(product: ProductContext): ProductAttributeLike[] {
  const attrs = product.attributes;
  return Array.isArray(attrs) ? (attrs as ProductAttributeLike[]) : [];
}

/** Resolve a dynamic text source; null when the product has no such data. */
export function resolveDynamicText(
  source: DynamicContentSource,
  product: ProductContext | undefined | null,
  settings: Record<string, unknown>,
  locale: string,
): DynamicText | null {
  if (!product) return null;
  const tr = pickProductTranslation(product, locale);
  switch (source) {
    case 'product_description': {
      const html = typeof tr?.description === 'string' ? tr.description : '';
      return html.trim() ? { kind: 'html', html } : null;
    }
    case 'product_short_description': {
      const html = typeof tr?.short_description === 'string' ? tr.short_description : '';
      return html.trim() ? { kind: 'html', html } : null;
    }
    case 'product_title': {
      const text = (tr?.title || '').trim();
      return text ? { kind: 'text', text } : null;
    }
    case 'product_specifications': {
      const words = yesNoWords(locale);
      const rows = productAttributes(product).map((a) => ({
        id: a.id,
        label: attrLabel(a, locale),
        value: formatAttrValue(a, words),
        swatch: attrSwatchColor(a),
      }));
      return rows.length ? { kind: 'specs', rows } : null;
    }
    case 'product_attribute': {
      const attr = findAttribute(productAttributes(product), String(settings.attribute_key ?? ''));
      if (!attr) return null;
      const text = formatAttrValue(attr, yesNoWords(locale));
      return text.trim() ? { kind: 'text', text, swatch: attrSwatchColor(attr) } : null;
    }
  }
}

export interface DynamicImage {
  url: string;
  alt: string;
}

/** 1-based image position for `product_image_n` (1–20, default 2). */
export function imageIndexOf(settings: Record<string, unknown>): number {
  const n = Math.floor(Number(settings.image_index));
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(n, 20);
}

function toDynamicImage(product: ProductContext, img: ProductContext['images'][number] | undefined, locale: string): DynamicImage | null {
  const url = resolveMediaUrl(img?.url);
  if (!url) return null;
  const title = pickProductTranslation(product, locale)?.title || '';
  return { url, alt: (img?.alt_text || '').trim() || title };
}

/**
 * Resolve an image source on the server. For `variant_image` this is the
 * fallback the island shows without a product state (the featured image);
 * with a state the island follows the selected variant.
 */
export function resolveDynamicImage(
  source: DynamicImageSource,
  product: ProductContext | undefined | null,
  settings: Record<string, unknown>,
  locale: string,
): DynamicImage | null {
  if (!product) return null;
  const images = Array.isArray(product.images) ? product.images : [];
  if (source === 'product_image_n') return toDynamicImage(product, images[imageIndexOf(settings) - 1], locale);
  return toDynamicImage(product, images[0], locale);
}

/**
 * Whether the product has any image the gallery could lead with (product
 * images, a variant's own images, or a value-level image of an option).
 */
export function productHasAnyImage(product: ProductContext | undefined | null): boolean {
  if (!product) return false;
  if (Array.isArray(product.images) && product.images.some((i) => i?.url)) return true;
  const variants = (product.variants || []) as Array<{ images?: Array<{ url?: string }> }>;
  if (variants.some((v) => v.images?.some((i) => i?.url))) return true;
  const cfg = product.variant_option_config;
  if (Array.isArray(cfg)) {
    return cfg.some((c) => {
      const map = (c as { imageMap?: Record<string, unknown> } | null)?.imageMap;
      return !!map && Object.values(map).some((u) => typeof u === 'string' && u);
    });
  }
  return false;
}

// ── Builder hint ──────────────────────────────────────────────

const SOURCE_LABELS: Record<DynamicContentSource | DynamicImageSource, { en: string; ar: string }> = {
  product_description: { en: 'product description', ar: 'وصف المنتج' },
  product_short_description: { en: 'short description', ar: 'الوصف المختصر' },
  product_specifications: { en: 'specifications', ar: 'المواصفات' },
  product_attribute: { en: 'product attribute', ar: 'خاصية المنتج' },
  product_title: { en: 'product title', ar: 'اسم المنتج' },
  product_featured: { en: 'featured image', ar: 'الصورة الرئيسية' },
  product_image_n: { en: 'product image', ar: 'صورة المنتج' },
  variant_image: { en: 'variant image', ar: 'صورة الخيار المحدد' },
};

/**
 * Dashed hint shown only in the builder preview when a dynamic source has
 * nothing to show (no product in context, or the product lacks the data).
 * The live store renders nothing in that case.
 */
export function DynamicSourceHint({
  source,
  locale,
  hasProduct,
  className,
  style,
}: {
  source: DynamicContentSource | DynamicImageSource;
  locale: string;
  hasProduct: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ar = locale === 'ar';
  const label = SOURCE_LABELS[source];
  const reason = hasProduct
    ? ar
      ? 'المنتج التجريبي لا يحتوي هذه البيانات.'
      : 'The sample product has no such data.'
    : ar
      ? 'يظهر المحتوى في صفحة المنتج.'
      : 'Shown on the product page.';
  return (
    <div
      className={`text-center py-6 px-4 ${className || ''}`}
      data-dynamic-source-hint={source}
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px dashed var(--theme-colors-border)',
        borderRadius: 'var(--theme-radius-md)',
        color: 'var(--theme-colors-muted)',
        ...style,
      }}
    >
      <div className="text-xs uppercase tracking-wide">
        {ar ? `ديناميكي: ${label.ar}` : `Dynamic: ${label.en}`}
      </div>
      <p className="text-xs mt-1">{reason}</p>
    </div>
  );
}

/** Specifications table, markup copied from the monolith's specifications tab. */
export function SpecsTable({ rows }: { rows: SpecRow[] }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-x-auto max-w-2xl">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-gray-500 font-medium w-2/5 border-b border-gray-100">{row.label}</td>
              <td className="px-4 py-3 text-gray-900 font-semibold border-b border-gray-100 wrap-break-word">
                {row.swatch ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 border border-gray-200 inline-block"
                      style={{ backgroundColor: row.swatch, borderRadius: 'var(--theme-swatch-radius, 9999px)' }}
                    />
                    {row.value}
                  </span>
                ) : (
                  row.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Prose classes of the product description (monolith description tab). */
export const PRODUCT_PROSE_CLASS =
  'prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto';

/**
 * Builder flag for a section with a dynamic source: SectionRenderer passes
 * an explicit boolean; a direct render without it counts as the live store.
 */
export function isDynamicPreview(builderPreview: boolean | undefined): boolean {
  return builderPreview === true;
}
