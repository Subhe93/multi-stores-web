// Decorative accent under a big heading: a short line or a brush stroke
// (settings `heading_accent` / `heading_accent_color`). Rendered as the last
// child INSIDE the heading element, after the text, so its `em` sizes follow
// the heading. Purely decorative (aria-hidden). 'none' or an unknown value
// renders nothing at all, so a section without the setting keeps its markup.
//
// No 'use client' and no hooks: imported by server sections and by the
// client hero slider / hero video alike. Sizes and alignment live in
// globals.css (.heading-accent); the colour is always an inline style,
// because the store layout's own `main span` colour rule would beat a class.

import { colorOr } from '../../../elementStyles';
import { headingAccentValue } from './headingAccentFields';

export type HeadingAccentAlign = 'start' | 'center' | 'end' | 'left' | 'right';

interface HeadingAccentProps {
  /** Stored `heading_accent`. */
  variant: unknown;
  /** Stored `heading_accent_color`; empty = the theme accent colour. */
  color?: unknown;
  /** Alignment of the heading it sits under (logical, or the physical values some sections store). */
  align?: HeadingAccentAlign;
}

// One closed shape, drawn left to right: blunt start, slightly uneven body,
// tapering to a point. Mirrored in right-to-left pages by CSS.
const BRUSH_PATH =
  'M1 7.5C2.5 4.6 8 3.4 20 3.1 46 2.4 82 3.6 118 2.9 150 2.3 176 3.9 199 5.6 176 6.6 150 7.2 118 7.4 82 7.7 46 8.6 20 9.3 9 9.7 2.5 9.6 1 7.5Z';

const ALIGNS: readonly HeadingAccentAlign[] = ['start', 'center', 'end', 'left', 'right'];

export function HeadingAccent({ variant, color, align }: HeadingAccentProps) {
  const kind = headingAccentValue(variant);
  if (kind === 'none') return null;
  const dataAlign = align && ALIGNS.includes(align) ? align : 'start';
  return (
    <span
      aria-hidden="true"
      className="heading-accent"
      data-variant={kind}
      data-align={dataAlign}
      style={{ color: colorOr(color, 'var(--theme-colors-accent)') }}
    >
      {kind === 'brush' && (
        <svg viewBox="0 0 200 12" preserveAspectRatio="none" focusable="false">
          <path d={BRUSH_PATH} fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
