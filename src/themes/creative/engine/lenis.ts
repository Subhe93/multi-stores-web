// Lenis chunk boundary. lenis.css is NOT imported: the store keeps native
// scroll positions, and the one rule that matters (scroll-behavior) is set
// by the store runtime while the instance lives.

import type Lenis from 'lenis';

export type LenisInstance = Lenis;

// Nested scrollers that must keep their native wheel behaviour.
const PREVENT = '[role="dialog"],[aria-modal="true"],.store-overlay,[data-lenis-prevent]';

export async function createLenis(): Promise<LenisInstance> {
  const { default: LenisCtor } = await import('lenis');
  return new LenisCtor({
    lerp: 0.1,
    smoothWheel: true,
    prevent: (node: HTMLElement) => !!node.closest?.(PREVENT),
  });
}
