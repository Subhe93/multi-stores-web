// Motion components for the two recipes that need extra elements: a heading
// split into masked words (heading-lines) and an image inside a mask
// (media-mask). Both render their plain content, with no extra element, when
// the section got no `motion` prop. Server-safe and client-safe.

import type { CSSProperties, ReactNode } from 'react';
import type { MotionProp } from '../recipes';
import { HeadingText } from './HeadingText';
import { MaskReveal } from './parts';

/**
 * heading-lines: the children of a heading element. Each word sits in its
 * own mask and rises into place; words on the same line move together and
 * the lines follow each other (the engine groups them when it arms the
 * heading; on the first section the words run in a tight wave instead,
 * CSS only). Words are the smallest unit for every script: Arabic is never
 * split into characters. `text` may contain "\n" line breaks; the text
 * content of the heading does not change.
 */
export function MotionText({ motion, text, d }: { motion: MotionProp; text: string; d?: number }) {
  if (!motion) return <>{text}</>;
  return <HeadingText text={text} reveal={motion} delay={typeof d === 'number' && d > 0 ? d / 10 : undefined} />;
}

/**
 * media-mask: wraps an image. On scroll the frame opens (clip from the
 * bottom, or from the inline start / end) while the image settles from
 * 1.16 to 1. On the first section, or with `priority`, the image only
 * settles from 1.06 and is never clipped or transparent: it may be the LCP
 * element. `fill` = the image is absolutely positioned in a sized parent.
 */
export function MotionMedia({
  motion,
  priority = false,
  dir = 'up',
  fill = false,
  className,
  style,
  children,
}: {
  motion: MotionProp;
  priority?: boolean;
  dir?: 'up' | 'start' | 'end';
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (!motion) return <>{children}</>;
  return (
    <MaskReveal
      mode={motion === 'intro' || priority ? 'intro' : 'scroll'}
      direction={dir}
      className={className}
      style={fill ? { position: 'absolute', inset: 0, ...style } : style}
    >
      {children}
    </MaskReveal>
  );
}
