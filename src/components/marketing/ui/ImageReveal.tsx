'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP, EASE, TRIGGER } from '@/lib/animations';

interface Props {
  children: ReactNode;
  className?: string;
  /** Parallax travel of the inner element while scrolling through (px). */
  parallax?: number;
  delay?: number;
}

/**
 * Clip-path reveal for any visual block (illustration, mock-up, card):
 * inset(100% 0 0 0) → 0 while the inner element eases from scale 1.18 to 1,
 * then a scrubbed parallax drift. Hidden-until-JS via `.sd-image-reveal`.
 */
export function ImageReveal({ children, className = '', parallax = 60, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const inner = el?.firstElementChild as HTMLElement | null;
      if (!el || !inner) return;
      gsap.fromTo(
        el,
        { clipPath: 'inset(100% 0 0 0)' },
        { clipPath: 'inset(0% 0 0 0)', duration: 1.6, delay, ease: EASE.expo, scrollTrigger: { trigger: el, start: TRIGGER.early, once: true } },
      );
      gsap.fromTo(inner, { scale: 1.18 }, { scale: 1, duration: 1.8, delay, ease: EASE.expo, scrollTrigger: { trigger: el, start: TRIGGER.early, once: true } });
      if (parallax) {
        gsap.fromTo(
          inner,
          { y: parallax * 0.5 },
          { y: -parallax * 0.5, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
        );
      }
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`sd-image-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
