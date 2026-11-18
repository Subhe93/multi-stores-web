'use client';

// Early fetch of the engine chunks for a store with the motion style on.
// The work happens when this module is evaluated (the browser loads it with
// the other client chunks of the page), not in an effect: the store runtime,
// the section scan with the engine core and Lenis are then already in flight
// or cached when CreativeBoot hydrates, instead of being requested one after
// the other from that moment on. Rendered only by StoreMotionAssets, so no
// other store ever loads this module.

let warmed = false;

function warm(): void {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  try {
    // Gate closed (reduced motion): the engine will not start.
    if (!document.documentElement.hasAttribute('data-cx-motion')) return;
    const ignore = () => {};
    import('./runtime/store').catch(ignore);
    import('./runtime/scan').catch(ignore);
    // Same conditions as the runtime: smooth scrolling on, desktop, fine pointer.
    const smoothOff = document.querySelector('.store-root[data-creative-smooth="off"]') !== null;
    const desktop =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;
    if (!smoothOff && desktop) import('lenis').catch(ignore);
  } catch {
    // Warming is an optimisation only.
  }
}

warm();

/** Renders nothing: mounting it is what makes the browser load this module. */
export function CreativeWarm(): null {
  return null;
}
