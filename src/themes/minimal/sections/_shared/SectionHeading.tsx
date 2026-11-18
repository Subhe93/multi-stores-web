// Shared section header: optional eyebrow + heading + subheading with the
// theme's typographic rhythm (large fluid heading, tight tracking, muted
// subcopy). Sections adopt this so headings read consistently premium across
// the whole storefront instead of each section re-styling its own <h2>.

import type { CSSProperties } from 'react';
import { colorOr } from '../../../elementStyles';
import type { TextTag } from './headingLevel';
import { Heading } from './Heading';
import { multilineStyle } from './headingLines';

// 'start' is the logical (direction-aware) alignment; 'left' / 'right' are
// kept for the sections that already use them.
type Align = 'left' | 'center' | 'right' | 'start';

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center mx-auto',
  right: 'text-right items-end ms-auto',
  start: 'text-start items-start',
};

interface SectionHeadingProps {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  align?: Align;
  /** Visual size: h1 (hero) or the default h2; also the element unless `tag` is set. */
  as?: 'h1' | 'h2';
  /** HTML element only (builder heading level); the size still follows `as`. */
  tag?: TextTag;
  /** Builder tags of the subheading / eyebrow (default p / span). */
  subheadingTag?: TextTag;
  eyebrowTag?: TextTag;
  headingColor?: unknown;
  subheadingColor?: unknown;
  eyebrowColor?: unknown;
  className?: string;
  /** A thin rule on each side of the heading. Only with `align: 'center'`. */
  ruled?: boolean;
  /**
   * Keep the manual line breaks ("\n") of a heading normalized by
   * headingLines. Off by default: the other callers render as they always did.
   */
  multiline?: boolean;
}

export function SectionHeading({
  eyebrow,
  heading,
  subheading,
  align = 'center',
  as = 'h2',
  tag,
  subheadingTag = 'p',
  eyebrowTag = 'span',
  headingColor,
  subheadingColor,
  eyebrowColor,
  className,
  ruled = false,
  multiline = false,
}: SectionHeadingProps) {
  if (!eyebrow && !heading && !subheading) return null;
  const headingStyle: CSSProperties = {
    fontFamily: 'var(--theme-font-heading)',
    fontSize: as === 'h1' ? 'var(--theme-scale-h1)' : 'var(--theme-scale-h2)',
    fontWeight: 'var(--theme-weight-heading)',
    lineHeight: 'var(--theme-line-heading)',
    letterSpacing: 'var(--theme-tracking-heading)',
    color: colorOr(headingColor, 'var(--theme-colors-text)'),
    ...(multiline && heading ? multilineStyle(heading) : {}),
  };

  return (
    <div className={`flex flex-col gap-3 max-w-2xl ${ALIGN_CLASS[align]} ${className || ''}`}>
      {eyebrow && (
        <Heading
          level={eyebrowTag}
          original="span"
          look="body"
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: colorOr(eyebrowColor, 'var(--theme-colors-accent)') }}
        >
          {eyebrow}
        </Heading>
      )}
      {heading && ruled && align === 'center' ? (
        <div className="flex w-full items-center justify-center gap-4 md:gap-6">
          <span aria-hidden className="h-px flex-1 max-w-24" style={{ backgroundColor: 'var(--theme-colors-border)' }} />
          <Heading level={tag ?? as} style={headingStyle}>
            {heading}
          </Heading>
          <span aria-hidden className="h-px flex-1 max-w-24" style={{ backgroundColor: 'var(--theme-colors-border)' }} />
        </div>
      ) : heading ? (
        <Heading level={tag ?? as} style={headingStyle}>
          {heading}
        </Heading>
      ) : null}
      {subheading && (
        <Heading
          level={subheadingTag}
          look="body"
          className="text-base leading-relaxed"
          style={{ color: colorOr(subheadingColor, 'var(--theme-colors-muted)') }}
        >
          {subheading}
        </Heading>
      )}
    </div>
  );
}
