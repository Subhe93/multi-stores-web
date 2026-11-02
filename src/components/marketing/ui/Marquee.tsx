'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from '@/lib/animations';

interface Props {
  items: ReactNode[];
  /** Seconds for one full loop of the track. */
  duration?: number;
  /** Reverse direction (also flipped automatically in RTL). */
  reverse?: boolean;
  separator?: ReactNode;
  className?: string;
  /** Slow the track while the pointer is over it. */
  hoverSlow?: boolean;
}

/**
 * Infinite horizontal marquee driven by GSAP (not CSS) so it can be slowed on
 * hover and keeps a stable speed regardless of width. The track is duplicated
 * once and translated by exactly half its width per loop. In RTL the sign
 * flips so the text still travels "forward" for the reader.
 */
export function Marquee({ items, duration = 28, reverse = false, separator = '·', className = '', hoverSlow = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = ref.current?.querySelector<HTMLElement>('.sd-marquee-track');
      if (!track) return;
      const rtl = getComputedStyle(track).direction === 'rtl';
      const dir = (reverse ? 1 : -1) * (rtl ? -1 : 1);
      const tween = gsap.fromTo(
        track,
        { xPercent: 0 },
        { xPercent: dir * 50, duration, ease: 'none', repeat: -1 },
      );
      if (!hoverSlow) return;
      const slow = () => gsap.to(tween, { timeScale: 0.25, duration: 0.6 });
      const fast = () => gsap.to(tween, { timeScale: 1, duration: 0.6 });
      track.addEventListener('pointerenter', slow);
      track.addEventListener('pointerleave', fast);
      return () => {
        track.removeEventListener('pointerenter', slow);
        track.removeEventListener('pointerleave', fast);
      };
    },
    { scope: ref },
  );

  const row = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="sd-marquee-item">
        <span>{item}</span>
        <span className="sd-marquee-sep" aria-hidden="true">
          {separator}
        </span>
      </span>
    ));

  return (
    <div ref={ref} className={`sd-marquee ${className}`.trim()} aria-hidden="true">
      <div className="sd-marquee-track">
        {row('a')}
        {row('b')}
      </div>
    </div>
  );
}
