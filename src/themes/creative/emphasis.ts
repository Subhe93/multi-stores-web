// Accent phrase of a heading. The owner marks it in the heading text itself
// (`More than *just a drink*`), per locale, so no extra translatable field
// exists. One pair per line; unbalanced markers stay ordinary text.

export type Emphasis = 'none' | 'color' | 'italic';

export function emphasisValue(raw: unknown, fallback: Emphasis): Emphasis {
  return raw === 'none' || raw === 'color' || raw === 'italic' ? raw : fallback;
}

export interface EmphasisPart {
  text: string;
  em: boolean;
}

/**
 * Splits ONE line at its first balanced `*…*` pair (non-empty inside). The
 * markers of that pair are dropped; any further asterisk stays text.
 */
export function parseEmphasis(line: string): EmphasisPart[] {
  const open = line.indexOf('*');
  if (open === -1) return line ? [{ text: line, em: false }] : [];
  const close = line.indexOf('*', open + 1);
  if (close === -1 || !line.slice(open + 1, close).trim()) return [{ text: line, em: false }];
  const parts: EmphasisPart[] = [];
  if (open > 0) parts.push({ text: line.slice(0, open), em: false });
  parts.push({ text: line.slice(open + 1, close), em: true });
  if (close < line.length - 1) parts.push({ text: line.slice(close + 1), em: false });
  return parts;
}

/** The text with the markers of every parsed pair removed (line by line). */
export function stripEmphasis(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      parseEmphasis(line)
        .map((p) => p.text)
        .join(''),
    )
    .join('\n');
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Any Arabic-script character: such text is never italic, outlined, spaced or uppercased. */
export function isArabicScript(text: string): boolean {
  return ARABIC.test(text);
}
