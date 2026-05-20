// Shared section header: optional eyebrow + heading + subheading with the
// theme's typographic rhythm (large fluid heading, tight tracking, muted
// subcopy). Sections adopt this so headings read consistently premium across
// the whole storefront instead of each section re-styling its own <h2>.

import type { CSSProperties } from 'react';
import { colorOr } from '../../../elementStyles';

type Align = 'left' | 'center' | 'right';

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center mx-auto',
  right: 'text-right items-end ms-auto',
};

interface SectionHeadingProps {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  align?: Align;
  /** Render the heading as h1 (hero) instead of the default h2. */
  as?: 'h1' | 'h2';
  headingColor?: unknown;
  subheadingColor?: unknown;
  eyebrowColor?: unknown;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  heading,
  subheading,
  align = 'center',
  as = 'h2',
  headingColor,
  subheadingColor,
  eyebrowColor,
  className,
}: SectionHeadingProps) {
  if (!eyebrow && !heading && !subheading) return null;
  const Tag = as;
  const headingStyle: CSSProperties = {
    fontFamily: 'var(--theme-font-heading)',
    fontSize: as === 'h1' ? 'var(--theme-scale-h1)' : 'var(--theme-scale-h2)',
    fontWeight: 'var(--theme-weight-heading)',
    lineHeight: 'var(--theme-line-heading)',
    letterSpacing: 'var(--theme-tracking-heading)',
    color: colorOr(headingColor, 'var(--theme-colors-text)'),
  };

  return (
    <div className={`flex flex-col gap-3 max-w-2xl ${ALIGN_CLASS[align]} ${className || ''}`}>
      {eyebrow && (
        <span
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: colorOr(eyebrowColor, 'var(--theme-colors-accent)') }}
        >
          {eyebrow}
        </span>
      )}
      {heading && <Tag style={headingStyle}>{heading}</Tag>}
      {subheading && (
        <p
          className="text-base leading-relaxed"
          style={{ color: colorOr(subheadingColor, 'var(--theme-colors-muted)') }}
        >
          {subheading}
        </p>
      )}
    </div>
  );
}
