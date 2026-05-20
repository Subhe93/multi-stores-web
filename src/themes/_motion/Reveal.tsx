'use client';

// Scroll-in reveal built on framer-motion. Starts hidden and animates once when
// scrolled into view. SSR-safe: the rendered element and its initial style are
// deterministic (no branching on a client-only media query), so server and
// client markup match during hydration. prefers-reduced-motion is honoured
// globally by <MotionProvider> (MotionConfig reducedMotion="user"), which keeps
// the opacity fade but drops the transform movement.

import { motion, type Variants } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale';

const OFFSET = 22;

function hiddenFor(dir: RevealDirection): Record<string, number> {
  switch (dir) {
    case 'up': return { opacity: 0, y: OFFSET };
    case 'down': return { opacity: 0, y: -OFFSET };
    case 'left': return { opacity: 0, x: OFFSET };
    case 'right': return { opacity: 0, x: -OFFSET };
    case 'scale': return { opacity: 0, scale: 0.96 };
    case 'fade':
    default: return { opacity: 0 };
  }
}

interface RevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  /** Seconds to wait before the entrance starts (use for hand-tuned sequencing). */
  delay?: number;
  /** Animation duration in seconds. */
  duration?: number;
  className?: string;
  style?: CSSProperties;
  /** Render as a different element (defaults to div). */
  as?: 'div' | 'section' | 'span' | 'li';
  // Forwarded data-* attributes (data-section-id / data-section-key).
  [key: `data-${string}`]: string | undefined;
}

export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  className,
  style,
  as = 'div',
  ...rest
}: RevealProps) {
  const MotionTag = motion[as];

  const variants: Variants = {
    hidden: hiddenFor(direction),
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <MotionTag
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -8% 0px', amount: 0.08 }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
