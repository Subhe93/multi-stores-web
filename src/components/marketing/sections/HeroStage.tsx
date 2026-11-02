'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP, EASE, DUR, STAGGER, onPageReveal, prefersReducedMotion } from '@/lib/animations';

interface Props {
  children: ReactNode;
  scrollLabel: string;
}

/**
 * Client shell of the hero. After the page-reveal handshake it fades the
 * badge, lead, CTAs and the foot in (the headline is handled by SplitReveal
 * `immediate`), then lets the copy drift up and dim while the hero scrolls
 * away so the door section feels like it rises over it.
 */
export function HeroStage({ children, scrollLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const section = root.closest('section') ?? root;
      const fades = gsap.utils.toArray<HTMLElement>('[data-hero-fade]', root);
      const hint = root.querySelector<HTMLElement>('.sd-hero-scroll');
      const inner = root.querySelector<HTMLElement>('.sd-hero-inner');

      if (!prefersReducedMotion() && inner) {
        gsap.to(inner, {
          y: -90,
          autoAlpha: 0.35,
          ease: EASE.linear,
          scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
        });
      }

      return onPageReveal(() => {
        gsap.fromTo(
          fades,
          { autoAlpha: 0, y: 32 },
          { autoAlpha: 1, y: 0, duration: DUR.slow, ease: EASE.expo, stagger: STAGGER.loose, delay: 0.7 },
        );
        if (hint) gsap.fromTo(hint, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.base, ease: EASE.soft, delay: 1.9 });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="sd-hero-stage">
      {children}
      <a href="#door" className="sd-hero-scroll" data-reveal="block" aria-label={scrollLabel}>
        <span className="sd-hero-scroll-label">{scrollLabel}</span>
        <span className="sd-hero-scroll-track" aria-hidden="true">
          <span className="sd-hero-scroll-thumb" />
        </span>
      </a>
    </div>
  );
}
