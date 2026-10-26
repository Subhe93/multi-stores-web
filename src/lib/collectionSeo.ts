// Collection SEO fields (M4.4 §13b). Pure helpers shared by the collection
// page metadata; stores that never set these fields get today's output.

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

const NAMED_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Plain text of an HTML fragment: tags stripped, the common entities decoded
 * (so an editor-saved `<p>&nbsp;</p>` counts as empty), whitespace collapsed.
 */
export function stripHtmlToText(html: string | null | undefined): string {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith('#')) {
        const cp = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
      }
      return NAMED_ENTITIES[lower] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Description: the SEO description when set, else the plain-text short
 * description, else (M6.2) the first 160 chars of the long description.
 */
export function collectionMetaDescription(tr: CollectionSeoTranslation | undefined): string | undefined {
  const meta = tr?.meta_desc?.trim();
  if (meta) return meta;
  const short = stripHtmlToText(tr?.description).slice(0, 160);
  if (short) return short;
  return stripHtmlToText(tr?.long_description).slice(0, 160) || undefined;
}

/** True when a flagged collection lists no published product. */
export function collectionIsNoindex(c: CollectionSeoFlags): boolean {
  return c.noindex_when_empty === true && c.published_product_count === 0;
}
