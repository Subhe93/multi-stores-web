// Manual line breaks in a section heading. The owner types the heading on
// several lines in the builder (a textarea); the text is stored with "\n" in
// the per-locale `content.heading` string and rendered as ONE text node with
// `white-space: pre-line`. No <br>, no markup: React escapes the text, and
// the builder's inline editing reads the same "\n" back through innerText.
//
// A heading without a break gets no extra style, so its HTML is exactly what
// it was before this helper existed.

import type { CSSProperties } from 'react';

/** Most lines a heading keeps; the text of any further line joins the last. */
export const HEADING_MAX_LINES = 4;

// Every line terminator a paste can carry: CRLF, CR, vertical tab, form
// feed, and the Unicode line / paragraph separators.
const LINE_BREAKS = /\r\n|[\r\v\f\u2028\u2029]/g;

/**
 * Normalized heading: each line trimmed, empty lines dropped, at most
 * HEADING_MAX_LINES lines (the rest is appended to the last one with a
 * space, so no text is lost), joined with "\n". A non-string reads as ''.
 * For a text without a break the result equals `raw.trim()`.
 */
export function headingLines(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const lines = raw
    .replace(LINE_BREAKS, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > HEADING_MAX_LINES) {
    const tail = lines.splice(HEADING_MAX_LINES - 1).join(' ');
    lines.push(tail);
  }
  return lines.join('\n');
}

/** The heading on one line (for an image alt text fallback). */
export function headingOneLine(text: string): string {
  return text.split('\n').join(' ');
}

/** `white-space: pre-line` only for a heading that has a manual break. */
export function multilineStyle(text: string): CSSProperties {
  return text.includes('\n') ? { whiteSpace: 'pre-line' } : {};
}
