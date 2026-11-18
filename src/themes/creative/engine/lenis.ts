// Lenis chunk boundary. lenis.css is NOT imported: the store keeps native
// scroll positions, and the one rule that matters (scroll-behavior) is set
// by the store runtime while the instance lives.

import type Lenis from 'lenis';

export type LenisInstance = Lenis;

// Timing benchmarked for the store (plans/newroj/STORE-MOTION-CONTRACT.md):
// one wheel step glides for about 1.1 s on an expo-out curve.
export const LENIS_DURATION = 1.1;
export const lenisEase = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Nested scrollers that must keep their native wheel behaviour.
const PREVENT = '[role="dialog"],[aria-modal="true"],.store-overlay,[data-lenis-prevent]';

export async function createLenis(): Promise<LenisInstance> {
  const { default: LenisCtor } = await import('lenis');
  return new LenisCtor({
    duration: LENIS_DURATION,
    easing: lenisEase,
    smoothWheel: true,
    // Wheel only: touch screens keep their native scrolling.
    syncTouch: false,
    // Lists, menus and text areas that scroll on their own keep the wheel
    // until they reach their end.
    allowNestedScroll: true,
    // The gate (html[data-cx-motion]) already decided: the runtime creates
    // this instance only while motion is allowed and destroys it when the
    // visitor turns reduced motion on.
    respectReducedMotion: false,
    prevent: (node: HTMLElement) => !!node.closest?.(PREVENT),
  });
}
