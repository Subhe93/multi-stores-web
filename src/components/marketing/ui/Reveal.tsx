'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, useGSAP, EASE, DUR, DIST, STAGGER, TRIGGER } from '@/lib/animations';

interface Props {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Animate direct children one after another instead of the block itself. */
  stagger?: boolean;
  delay?: number;
  y?: number;
  duration?: number;
  id?: string;
}

/**
 * Scroll-triggered fade + rise. Hidden by CSS only when `html.js` is present,
 * so users without JavaScript still see the content. In stagger mode the
 * wrapper must be made visible explicitly because the children inherit
 * `visibility: hidden` from it.
 */
export function Reveal({ children, as: Tag = 'div', className, stagger = false, delay = 0, y = DIST.md, duration = DUR.slow, id }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = stagger ? Array.from(el.children) : [el];
      if (stagger) gsap.set(el, { visibility: 'visible' });
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration,
          delay,
          ease: EASE.expo,
          stagger: stagger ? STAGGER.base : 0,
          scrollTrigger: { trigger: el, start: TRIGGER.reveal, once: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} id={id} className={className} data-reveal={stagger ? 'stagger' : 'block'}>
      {children}
    </Tag>
  );
}
