// Fallback meta description for a page without one: the first text of its
// content, trimmed to a search-snippet length. Without it the page inherited
// the store-wide description (e.g. an English default on a Swedish policy
// page), the same text on every such page.

import type { SectionInstance } from '@/themes/types';
import { stripHtmlToText } from './htmlText';

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

/**
 * The one meta-description clipper (M161 D): whitespace (incl. CR LF)
 * collapsed; text of at most `max` characters is returned as is; longer text
 * is cut at the last whitespace at or before `max - 1` characters, trailing
 * punctuation and spaces trimmed, and an ellipsis added. Only a single word
 * longer than the limit is hard-cut.
 */
export function clipDescription(text: string, max = MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max);
  const space = head.lastIndexOf(' ');
  const cut = space > 0 ? head.slice(0, space) : clean.slice(0, max - 1);
  const trimmed = cut.replace(/[\s,.;:!?–—-]+$/, '');
  return `${trimmed || cut}…`;
}

/**
 * Auto-generated meta description from rich text (no author-written one):
 * plain text with entities decoded, clipped by `clipDescription`. Undefined
 * when nothing is left.
 */
export function metaDescriptionFallback(html: string | null | undefined): string | undefined {
  const text = stripHtmlToText(html);
  return text ? clipDescription(text) : undefined;
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
