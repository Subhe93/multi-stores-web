// Collection SEO fields (M4.4 §13b). Pure helpers shared by the collection
// page metadata; stores that never set these fields get today's output.

import { stripHtmlToText } from './htmlText';
import { metaDescriptionFallback } from './pageExcerpt';

export interface CollectionSeoTranslation {
  name?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_desc?: string | null;
  /** M6.2: long SEO description HTML, the last fallback for the meta description. */
  long_description?: string | null;
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

export { stripHtmlToText };

/**
 * Description: the SEO description when set, else the plain-text short
 * description, else (M6.2) the long description, both clipped at a word
 * boundary (M161 D, `metaDescriptionFallback`).
 */
export function collectionMetaDescription(tr: CollectionSeoTranslation | undefined): string | undefined {
  const meta = tr?.meta_desc?.trim();
  if (meta) return meta;
  return metaDescriptionFallback(tr?.description) ?? metaDescriptionFallback(tr?.long_description);
}

/** True when a flagged collection lists no published product. */
export function collectionIsNoindex(c: CollectionSeoFlags): boolean {
  return c.noindex_when_empty === true && c.published_product_count === 0;
}
