// Scrub parallax. Layers inside the host declare their travel over the
// section's pass through the viewport:
//   data-cx-y="-6"       percent of the layer's own height
//   data-cx-x="24"       px along the inline axis (sign flips in RTL)
//   data-cx-rotate="25"  degrees
//   data-cx-scale="1.1"
// A layer must not carry a stylesheet transform or be the target of the
// `pointer` behaviour: use a dedicated wrapper for each.

import type { Behavior } from '../core';

const LAYERS = '[data-cx-y],[data-cx-x],[data-cx-rotate],[data-cx-scale]';

const scrub: Behavior = async (el, ctx) => {
  // Off on phones.
  if (!window.matchMedia('(min-width: 768px)').matches) return;
  const layers = Array.from(el.querySelectorAll<HTMLElement>(LAYERS));
  if (el.matches(LAYERS)) layers.unshift(el);
  if (!layers.length) return;

  const { gsap } = await ctx.loadGsap();
  const sign = ctx.rtl ? -1 : 1;
  const tweens = layers.map((layer) => {
    const read = (name: string): number | null => {
      const v = parseFloat(layer.getAttribute(name) || '');
      return Number.isFinite(v) ? v : null;
    };
    const y = read('data-cx-y');
    const x = read('data-cx-x');
    const rotate = read('data-cx-rotate');
    const scale = read('data-cx-scale');
    const vars: gsap.TweenVars = {
      ease: 'none',
      scrollTrigger: {
        trigger: ctx.scope,
        start: 'clamp(top bottom)',
        end: 'clamp(bottom top)',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    };
    if (y !== null) vars.yPercent = () => y;
    if (x !== null) vars.x = () => x * sign;
    if (rotate !== null) vars.rotation = () => rotate * sign;
    if (scale !== null) vars.scale = () => scale;
    return gsap.to(layer, vars);
  });

  return () => {
    for (const tween of tweens) {
      tween.scrollTrigger?.kill();
      tween.revert();
    }
  };
};

export default scrub;
