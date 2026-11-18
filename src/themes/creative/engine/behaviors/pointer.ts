// Pointer parallax. Layers inside the host carry data-cx-pointer="<px>": the
// distance they drift toward the pointer at the section's edge. Fine
// pointers only; the GSAP ticker works only while a tween is running, so
// nothing runs when the pointer is elsewhere. A layer must not be a `scrub`
// layer too (both write the transform): nest two wrappers.

import type { Behavior } from '../core';
import { finePointer } from '../env';

const pointer: Behavior = async (el, ctx) => {
  if (!finePointer()) return;
  const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-cx-pointer]'));
  if (el.matches('[data-cx-pointer]')) layers.unshift(el);
  if (!layers.length) return;

  const { gsap } = await ctx.loadGsap();
  const scope = ctx.scope;
  const items = layers
    .map((layer) => ({
      px: parseFloat(layer.getAttribute('data-cx-pointer') || ''),
      x: gsap.quickTo(layer, 'x', { duration: 0.6, ease: 'power3.out' }),
      y: gsap.quickTo(layer, 'y', { duration: 0.6, ease: 'power3.out' }),
    }))
    .filter((item) => Number.isFinite(item.px) && item.px !== 0);

  const onMove = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const rect = scope.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    for (const item of items) {
      item.x(nx * item.px);
      item.y(ny * item.px);
    }
  };
  const onLeave = () => {
    for (const item of items) {
      item.x(0);
      item.y(0);
    }
  };
  scope.addEventListener('pointermove', onMove, { passive: true });
  scope.addEventListener('pointerleave', onLeave);

  return () => {
    scope.removeEventListener('pointermove', onMove);
    scope.removeEventListener('pointerleave', onLeave);
    gsap.killTweensOf(layers);
    gsap.set(layers, { clearProps: 'transform' });
  };
};

export default pointer;
