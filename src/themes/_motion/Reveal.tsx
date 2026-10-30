'use client';

// Scroll-in reveal driven by CSS + one shared IntersectionObserver (no
// framer-motion). The server HTML is always fully visible: the hidden state
// only applies once JS arms an element by setting data-reveal-state="pending",
// and elements already in the viewport at mount are never armed. So content
// renders without JS and the LCP section never starts hidden. Styles live in
// globals.css ([data-reveal]); prefers-reduced-motion keeps the fade only.

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { isInViewport, observeOnce } from './inView';

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale';

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

// Matches the old framer viewport (bottom margin -8%, 8% visible).
// threshold 0: any visible pixel reveals (a very tall section never stays hidden).
const VIEWPORT = { rootMargin: '0px 0px -8% 0px', threshold: 0 };

export { isInViewport };

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
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Already visible at mount (above the fold / scrolled to): leave it alone.
    if (isInViewport(el)) return;
    el.dataset.revealState = 'pending';
    const stop = observeOnce(
      el,
      () => {
        el.dataset.revealState = 'shown';
      },
      VIEWPORT,
    );
    return () => {
      stop();
      // Never leave an element stuck hidden after unmount/re-run.
      delete el.dataset.revealState;
    };
  }, []);

  const timing: Record<string, string> = {};
  if (delay) timing['--reveal-delay'] = `${delay}s`;
  if (duration !== 0.6) timing['--reveal-duration'] = `${duration}s`;
  const mergedStyle = Object.keys(timing).length
    ? ({ ...timing, ...style } as CSSProperties)
    : style;

  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={className}
      style={mergedStyle}
      data-reveal={direction}
      {...rest}
    >
      {children}
    </Tag>
  );
}
