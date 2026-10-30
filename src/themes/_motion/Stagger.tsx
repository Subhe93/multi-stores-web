'use client';

// Staggered reveal for lists/grids: children fade/slide in one after another
// as the group scrolls into view. Wrap the grid in <StaggerGroup> and each cell
// in <StaggerItem>. CSS-driven (globals.css [data-stagger-item]) with the
// shared IntersectionObserver, no framer-motion. Like Reveal, the server HTML
// is fully visible: on mount the group arms its items (data-stagger-state=
// "pending" + --stagger-i index) only when it is still below the fold, then
// flips them to "shown" on intersection. prefers-reduced-motion keeps the fade.

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { isInViewport, observeOnce } from './inView';

// Matches the old framer viewport (bottom margin -6%, 10% visible).
// threshold 0: any visible pixel reveals, so a very tall group (more than
// 1/threshold viewports) can never stay hidden.
const VIEWPORT = { rootMargin: '0px 0px -6% 0px', threshold: 0 };
const DEFAULT_STEP = 0.08;

interface StaggerGroupProps {
  children: ReactNode;
  /** Delay between each child's entrance, in seconds. */
  step?: number;
  className?: string;
  style?: CSSProperties;
  /**
   * Never hidden, no entrance animation. For above-the-fold content (hero
   * text = the LCP).
   */
  immediate?: boolean;
}

/** Items that belong to `group` (not to a nested group), in DOM order. */
function ownItems(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>('[data-stagger-item]')).filter(
    (el) => el.parentElement?.closest('[data-stagger-group]') === group,
  );
}

export function StaggerGroup({ children, step = DEFAULT_STEP, className, style, immediate = false }: StaggerGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const group = ref.current;
    if (immediate || !group || typeof IntersectionObserver === 'undefined') return;
    // Already on screen at mount: leave it visible.
    if (isInViewport(group)) return;
    const items = ownItems(group);
    if (!items.length) return;
    items.forEach((el, i) => {
      el.style.setProperty('--stagger-i', String(i));
      el.dataset.staggerState = 'pending';
    });
    const stop = observeOnce(
      group,
      () => {
        for (const el of items) el.dataset.staggerState = 'shown';
      },
      VIEWPORT,
    );
    return () => {
      stop();
      // Never leave items stuck hidden after unmount/re-run.
      for (const el of items) delete el.dataset.staggerState;
    };
  }, [immediate]);

  const mergedStyle =
    step !== DEFAULT_STEP ? ({ '--stagger-step': `${step}s`, ...style } as CSSProperties) : style;

  return (
    <div
      ref={ref}
      className={className}
      style={mergedStyle}
      data-stagger-group={immediate ? 'immediate' : ''}
    >
      {children}
    </div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StaggerItem({ children, className, style }: StaggerItemProps) {
  return (
    <div className={className} style={style} data-stagger-item="">
      {children}
    </div>
  );
}
