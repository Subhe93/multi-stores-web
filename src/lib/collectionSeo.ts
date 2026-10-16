// Collection SEO fields (M4.4 §13b). Pure helpers shared by the collection
// page metadata; stores that never set these fields get today's output.

export interface CollectionSeoTranslation {
  name?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_desc?: string | null;
}

export interface CollectionSeoFlags {
  noindex_when_empty?: boolean | null;
  /** Present only when some collection of the store is flagged. */
  published_product_count?: number | null;
}

/** Title: the SEO title when set, else the collection name, else the handle. */
export function collectionMetaTitle(tr: CollectionSeoTranslation | undefined, handle: string): string {
  return tr?.meta_title?.trim() || tr?.name || handle;
}

/** Description: the SEO description when set, else the plain-text body (160 chars). */
export function collectionMetaDescription(tr: CollectionSeoTranslation | undefined): string | undefined {
  const meta = tr?.meta_desc?.trim();
  if (meta) return meta;
  return tr?.description?.replace(/<[^>]*>/g, '').slice(0, 160) || undefined;
}

/** True when a flagged collection lists no published product. */
export function collectionIsNoindex(c: CollectionSeoFlags): boolean {
  return c.noindex_when_empty === true && c.published_product_count === 0;
}
