'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGSAP, EASE, STAGGER, TRIGGER, fontsReady, refreshScroll } from '@/lib/animations';
import { ShaderBackdrop } from '@/components/marketing/ui/ShaderBackdrop';

/**
 * Client wrapper for the "how it works" stage. On wide screens (>= 1024px)
 * the stage pins for the length of the horizontal track and the three panels
 * scroll sideways under a scrubbed progress bar; each panel reveals (giant
 * numeral, copy, clip-path illustration, drawn strokes) the moment its inline
 * edge enters the viewport. Below 1024px nothing is pinned: the panels stack
 * and reveal on their own vertical position. In RTL the track travels in the
 * opposite direction, so the translation sign flips and the inline offsets
 * are measured from the track's end edge.
 */
export function HowTrack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const stage = ref.current;
      if (!stage) return;
      const section = (stage.closest('section') as HTMLElement | null) ?? stage;
      const viewport = stage.querySelector<HTMLElement>('.sd-how-viewport');
      const track = stage.querySelector<HTMLElement>('.sd-how-track');
      const fill = stage.querySelector<HTMLElement>('.sd-how-progress-fill');
      const counter = stage.querySelector<HTMLElement>('.sd-how-counter-now');
      if (!viewport || !track) return;
      const panels = gsap.utils.toArray<HTMLElement>('.sd-how-panel', track);
      const rtl = getComputedStyle(stage).direction === 'rtl';

      // Slow drift on the illustration parts: infinite tweens are created
      // synchronously here, never inside a callback.
      gsap.utils.toArray<Element>('[data-float]', stage).forEach((el, i) => {
        gsap.to(el, {
          y: i % 2 ? -7 : 7,
          duration: 3.4 + (i % 3) * 0.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: el.hasAttribute('data-float-delay') ? 0.9 : 0,
        });
      });

      // One paused reveal timeline per panel. `pathLength="1"` normalises the
      // dash maths so every stroke draws from 0 to 1 regardless of its size.
      const reveals = panels.map((panel) => {
        const num = panel.querySelector('.sd-how-num');
        const copy = panel.querySelectorAll('.sd-how-panel-copy > *');
        const figure = panel.querySelector<HTMLElement>('.sd-how-figure');
        const inner = figure?.firstElementChild as HTMLElement | null;
        const draws = gsap.utils.toArray<SVGGeometryElement>('[data-draw]', panel);
        draws.forEach((d) => d.setAttribute('pathLength', '1'));
        const tl = gsap.timeline({ paused: true });
        if (num) tl.fromTo(num, { autoAlpha: 0, yPercent: 30 }, { autoAlpha: 1, yPercent: 0, duration: 1.4, ease: EASE.expo }, 0);
        if (copy.length) tl.fromTo(copy, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE.expo, stagger: STAGGER.base }, 0.1);
        if (figure && inner) {
          tl.fromTo(figure, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.6, ease: EASE.expo }, 0.15);
          tl.fromTo(inner, { scale: 1.18 }, { scale: 1, duration: 1.8, ease: EASE.expo }, 0.15);
        }
        if (draws.length) tl.fromTo(draws, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: EASE.inOut, stagger: 0.08 }, 0.5);
        return tl;
      });
      const played = panels.map(() => false);
      const play = (i: number) => {
        if (played[i]) return;
        played[i] = true;
        reveals[i].play();
      };

      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        const gutter = () => parseFloat(getComputedStyle(viewport).paddingInlineStart) || 0;
        // Distance the track must travel so the last panel ends on the
        // trailing gutter. Viewport padding is symmetric.
        const dist = () => Math.max(0, track.offsetWidth - (viewport.clientWidth - gutter() * 2));
        // Progress at which each panel's inline-start edge crosses 85% of the
        // viewport width (measured from the track's start edge in both
        // directions).
        let thresholds: number[] = [];
        const measure = () => {
          const d = dist();
          const vw = viewport.clientWidth;
          thresholds = panels.map((p) => {
            const start = rtl ? track.offsetWidth - (p.offsetLeft + p.offsetWidth) : p.offsetLeft;
            return d ? (gutter() + start - vw * 0.85) / d : 0;
          });
        };
        measure();
        if (fill) gsap.set(fill, { transformOrigin: rtl ? '100% 50%' : '0% 50%', scaleX: 0 });

        gsap.to(track, {
          x: () => (rtl ? 1 : -1) * dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            pin: stage,
            start: 'top top',
            end: () => `+=${Math.round(dist() * 1.6)}`,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: measure,
            onUpdate: (self) => {
              const p = self.progress;
              if (fill) gsap.set(fill, { scaleX: p });
              if (counter) counter.textContent = String(Math.round(p * (panels.length - 1)) + 1).padStart(2, '0');
              thresholds.forEach((t, i) => {
                if (p >= t) play(i);
              });
            },
          },
        });
        // The first panel is already in view when the stage pins: reveal it as
        // the section enters, like any other block.
        ScrollTrigger.create({ trigger: section, start: TRIGGER.reveal, once: true, onEnter: () => play(0) });
      });

      mm.add('(max-width: 1023px)', () => {
        panels.forEach((panel, i) => {
          ScrollTrigger.create({ trigger: panel, start: TRIGGER.early, once: true, onEnter: () => play(i) });
        });
      });

      fontsReady().then(() => refreshScroll());
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="sd-how-stage">
      <ShaderBackdrop dark />
      <div className="sd-how-scrim" aria-hidden="true" />
      {children}
    </div>
  );
}
