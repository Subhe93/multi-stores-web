import type { CSSProperties, HTMLAttributes } from 'react';
import type { TextTag } from './headingLevel';

interface HeadingProps extends HTMLAttributes<HTMLElement> {
  level: TextTag;
  /**
   * Which store typography the text follows, whatever its tag: a subheading
   * set to h3 keeps the body font, a heading set to p keeps the heading
   * font (the store typography rules select by data-text-look, falling back
   * to the tag when it is absent).
   */
  look?: 'heading' | 'body';
  /** The section's own tag for this text: a span left unchanged stays inline. */
  original?: TextTag;
}

/**
 * A section text whose element comes from the builder (h1–h6, p, div, span).
 * Defined at module level so sections don't create a component during
 * render. A span chosen in place of a block tag is shown as a block.
 */
export function Heading({ level, look = 'heading', original, style, ...props }: HeadingProps) {
  const Tag = level;
  const merged: CSSProperties | undefined =
    level === 'span' && original !== 'span' ? { display: 'block', ...style } : style;
  return <Tag data-text-look={look} style={merged} {...props} />;
}
