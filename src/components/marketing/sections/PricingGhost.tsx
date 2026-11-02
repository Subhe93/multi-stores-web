'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/animations';

/**
 * The outlined word behind the pricing card. Two stacked lines drift in
 * opposite directions and tighten their tracking while the section scrolls
 * through, so the word feels engraved into the page rather than printed on
 * it. Always LTR: it is a graphic, not a sentence.
 */
export function PricingGhost({ word }: { word: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = word.trim().split(/\s+/);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const section = el.closest('section') ?? el;
      const spans = gsap.utils.toArray<HTMLElement>('.sd-pricing-ghost-line', el);
      spans.forEach((span, i) => {
        const dir = i % 2 ? 1 : -1;
        gsap.fromTo(
          span,
          { xPercent: dir * 6, letterSpacing: '0.02em' },
          {
            xPercent: dir * -6,
            letterSpacing: '-0.06em',
            ease: 'none',
            scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1 },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="sd-pricing-ghost" dir="ltr" aria-hidden="true">
      {lines.map((line, i) => (
        <span key={`${line}-${i}`} className="sd-pricing-ghost-line">
          {line}
        </span>
      ))}
    </div>
  );
}
