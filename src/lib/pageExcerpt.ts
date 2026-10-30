// Fallback meta description for a page without one: the first text of its
// content, trimmed to a search-snippet length. Without it the page inherited
// the store-wide description (e.g. an English default on a Swedish policy
// page), the same text on every such page.

import type { SectionInstance } from '@/themes/types';

const MAX = 155;

// Content keys that hold running text, in reading order within a section.
const TEXT_KEYS = ['subheading', 'body', 'content', 'html', 'text', 'description'];

export function plainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** At most MAX characters, cut at a word boundary with an ellipsis. */
export function clipDescription(text: string, max = MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Excerpt of a builder page's sections for `locale` (else primary, else first). */
export function sectionsExcerpt(
  sections: SectionInstance[] | null | undefined,
  locale: string,
  primaryLocale: string,
): string | undefined {
  let text = '';
  for (const s of [...(sections ?? [])].sort((a, b) => a.sort_order - b.sort_order)) {
    if (s.is_hidden) continue;
    // Some older snapshots keyed translations by locale instead of a list.
    const rows = Array.isArray(s.translations) ? s.translations : [];
    const row =
      rows.find((t) => t.locale === locale) ||
      rows.find((t) => t.locale === primaryLocale) ||
      rows[0];
    const content = row?.content ?? {};
    for (const key of TEXT_KEYS) {
      const value = content[key];
      if (typeof value === 'string' && value.trim()) text += ` ${plainText(value)}`;
    }
    if (text.trim().length >= MAX) break;
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean ? clipDescription(clean) : undefined;
}

/** Excerpt of a legacy page's rich-html content. */
export function htmlExcerpt(html: string | null | undefined): string | undefined {
  const clean = html ? plainText(html) : '';
  return clean ? clipDescription(clean) : undefined;
}
