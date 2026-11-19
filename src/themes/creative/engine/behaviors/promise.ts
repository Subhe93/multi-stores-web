// Behaviour "promise": the motion of "promise-band".
//
// Reveal, once, when the band's top passes 82 % of the viewport: the horizon
// line draws from the centre, the small sun rises with a pulse ring and a
// gleam runs along the line, the dividers grow, the items lift, the icons
// draw in, the titles rise through their masks, then numbers and texts
// fade up. Separately, the sun walks along the horizon while the band
// crosses the viewport (scrub 0.8; mirrored in right-to-left stores).
//
// The band is visible as it is until GSAP is ready; this behaviour hides
// its parts only then (gsap.set), and its context reverts everything.

import type { Behavior } from '../core';

const promise: Behavior = async (el, ctx) => {
  const { gsap } = await ctx.loadGsap();
  if (!el.isConnected) return;
  const all = (s: string) => Array.from(el.querySelectorAll<HTMLElement | SVGElement>(s));
  const line = el.querySelector<HTMLElement>('.cx-pm-hline');
  const sun = el.querySelector<HTMLElement>('.cx-pm-hsun');
  const gleam = el.querySelector<HTMLElement>('.cx-pm-gleam');
  if (!line || !sun || !gleam) return;
  const rtl = ctx.rtl ? -1 : 1;
  const expo = 'expo.out';
  // The pulse ring starts from the sun's own accent colour (owner tone).
  const red = getComputedStyle(sun).backgroundColor.replace(/^rgba?\(([^)]+)\)$/, '$1').split(',').slice(0, 3).join(',');

  const context = gsap.context(() => {
    const items = all('.cx-pm-item');
    const paths = all('.cx-pm-icon path');
    const images = all('[data-cx-pm-img]');
    const divs = all('.cx-pm-div');
    const masks = all('[data-cx-pm-mask]');
    const phone = window.matchMedia('(max-width: 767px)').matches;

    gsap.set(line, { scaleX: 0 });
    if (divs.length) gsap.set(divs, phone ? { scaleX: 0 } : { scaleY: 0 });
    if (paths.length) gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
    if (images.length) gsap.set(images, { opacity: 0 });
    if (masks.length) gsap.set(masks, { yPercent: 115 });
    gsap.set(all('[data-cx-pm-fade]'), { opacity: 0, y: 16 });
    gsap.set(sun, { opacity: 0, scale: 0.4, y: 12 });
    if (items.length) gsap.set(items, { y: 28 });

    const tl = gsap.timeline({
      defaults: { ease: expo },
      scrollTrigger: { trigger: el, start: 'clamp(top 82%)', once: true },
    });
    tl.to(line, { scaleX: 1, duration: 1.6 }, 0)
      .to(sun, { opacity: 1, scale: 1, y: 0, duration: 1.4 }, 0.35)
      .fromTo(
        sun,
        { boxShadow: `0 0 0 0px rgba(${red}, .38), 0 0 18px 4px rgba(${red}, .18)` },
        {
          boxShadow: `0 0 0 18px rgba(${red}, 0), 0 0 18px 4px rgba(${red}, .18)`,
          duration: 1.6,
          ease: 'power2.out',
          clearProps: 'boxShadow',
        },
        0.9,
      )
      .fromTo(
        gleam,
        { x: () => (rtl > 0 ? -gleam.offsetWidth : line.offsetWidth) },
        { x: () => (rtl > 0 ? line.offsetWidth : -gleam.offsetWidth), duration: 1.9, ease: 'power2.inOut' },
        0.7,
      )
      .fromTo(
        gleam,
        { opacity: 0 },
        { keyframes: [{ opacity: 1, duration: 0.5 }, { opacity: 1, duration: 0.9 }, { opacity: 0, duration: 0.5 }], ease: 'none' },
        0.7,
      );
    if (items.length) tl.to(items, { y: 0, duration: 1.5, stagger: 0.14 }, 0.3);
    const eyebrow = all('.cx-pm-eb');
    if (eyebrow.length) tl.to(eyebrow, { opacity: 1, y: 0, duration: 1.2 }, 0.1);
    if (divs.length) {
      tl.to(divs, phone ? { scaleX: 1, duration: 1.4, stagger: 0.14 } : { scaleY: 1, duration: 1.4, stagger: 0.14 }, 0.3);
    }
    if (paths.length) tl.to(paths, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.06 }, 0.35);
    if (images.length) tl.to(images, { opacity: 1, duration: 1.4, ease: 'power2.inOut', stagger: 0.14 }, 0.35);
    if (masks.length) tl.to(masks, { yPercent: 0, duration: 1.3, stagger: 0.13 }, 0.5);
    const rest = all('.cx-pm-num, .cx-pm-text');
    if (rest.length) tl.to(rest, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.7);

    // The sun walks along the horizon while the band crosses the viewport.
    gsap.fromTo(
      sun,
      { x: 0 },
      {
        x: () => (line.offsetWidth - sun.offsetWidth) * rtl,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
      },
    );
  }, el);

  return () => context.revert();
};

export default promise;
