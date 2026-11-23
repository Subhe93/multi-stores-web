// Plain text of editor-saved HTML (shared by SEO helpers; no imports, so any
// module can use it without an import cycle).

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
