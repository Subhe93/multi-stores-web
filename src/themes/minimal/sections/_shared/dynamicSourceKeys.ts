// Dynamic source keys (see ./dynamicSource.tsx). Import-free so the section
// renderer can tell a dynamic section apart without pulling in any helper.
// A missing, empty or unknown value means "static".

export const CONTENT_SOURCES = [
  'product_description',
  'product_short_description',
  'product_specifications',
  'product_attribute',
  'product_title',
] as const;
export type DynamicContentSource = (typeof CONTENT_SOURCES)[number];

export const IMAGE_SOURCES = ['product_featured', 'product_image_n', 'variant_image'] as const;
export type DynamicImageSource = (typeof IMAGE_SOURCES)[number];

/** The dynamic content source of a section, or null for static (default). */
export function dynamicContentSource(settings: Record<string, unknown>): DynamicContentSource | null {
  const v = settings.content_source;
  return (CONTENT_SOURCES as readonly unknown[]).includes(v) ? (v as DynamicContentSource) : null;
}

/** The dynamic image source of a section, or null for static (default). */
export function dynamicImageSource(settings: Record<string, unknown>): DynamicImageSource | null {
  const v = settings.image_source;
  return (IMAGE_SOURCES as readonly unknown[]).includes(v) ? (v as DynamicImageSource) : null;
}

/** Whether a section's settings pick any dynamic source. */
export function hasDynamicSource(settings: Record<string, unknown> | undefined | null): boolean {
  if (!settings) return false;
  return dynamicContentSource(settings) !== null || dynamicImageSource(settings) !== null;
}
