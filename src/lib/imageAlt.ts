/**
 * M170 A: alt text of a product image in the page locale.
 *
 * The API stores the default alt in `alt_text` (the store primary language)
 * and the other locales in `alt_translations` (`{ "de": "..." }`, present
 * only on product-detail images that have one; the write side lives in the
 * API's src/common/catalog/image-alt-translations.ts).
 *
 * Fallback chain: `alt_translations[locale]` -> `alt_translations[base
 * language]` (`de-AT` -> `de`, the M159 rule) -> the default alt -> the
 * caller's fallback (the product title of the rendered locale). Never
 * another language.
 */

export interface ImageAltSource {
  /** Pre-resolved alt some callers already carry (wins over `alt_text`). */
  alt?: string | null;
  alt_text?: string | null;
  alt_translations?: unknown;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const baseLanguage = (locale: string) => locale.split(/[-_]/)[0]!.toLowerCase();

const norm = (locale: string) => locale.replace('_', '-').toLowerCase();

const nonBlank = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

function mapValue(map: Record<string, unknown>, wanted: string): string | undefined {
  for (const [key, value] of Object.entries(map)) {
    if (norm(key) !== wanted || typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return undefined;
}

/** The localized alt of `locale` (exact, else its base language), if any. */
export function localizedImageAlt(translations: unknown, locale: string | null | undefined): string | undefined {
  if (!locale || !isPlainObject(translations)) return undefined;
  const exact = norm(locale);
  const base = baseLanguage(locale);
  return mapValue(translations, exact) ?? (base !== exact ? mapValue(translations, base) : undefined);
}

/**
 * The alt a merchant stored for this image in `locale`: the localized alt,
 * else the default alt. Undefined when the image has none (no title fallback).
 */
export function storedImageAlt(
  img: ImageAltSource | null | undefined,
  locale: string | null | undefined,
): string | undefined {
  if (!img) return undefined;
  // A whitespace-only default alt counts as no alt (the title is used). A
  // real alt is returned as stored, so it renders exactly as before M170.
  const fallback = nonBlank(img.alt) ?? nonBlank(img.alt_text);
  return localizedImageAlt(img.alt_translations, locale) ?? fallback;
}

/** `storedImageAlt` with the caller's fallback (the product title) as the last step. */
export function resolveImageAlt(
  img: ImageAltSource | null | undefined,
  locale: string | null | undefined,
  fallback: string,
): string {
  return storedImageAlt(img, locale) ?? fallback;
}

/**
 * `alt_translations` reduced to what a page in `locale` can render: the
 * locale itself and its base language. Undefined when nothing is left.
 */
export function pickAltTranslations(translations: unknown, locale: string): Record<string, string> | undefined {
  if (!isPlainObject(translations)) return undefined;
  const keep = new Set([norm(locale), baseLanguage(locale)]);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(translations)) {
    if (keep.has(norm(key)) && typeof value === 'string' && value.trim()) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
