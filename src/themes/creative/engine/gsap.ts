// Single registration point of GSAP for store code. Never import 'gsap'
// anywhere else under themes/: this module is the async chunk boundary, and
// lib/animations.ts (marketing) registers plugins the store must not load.

export interface GsapBundle {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
}

let bundle: GsapBundle | null = null;
let pending: Promise<GsapBundle> | null = null;

/** Loads gsap + ScrollTrigger once and registers the plugin. */
export function loadGsap(): Promise<GsapBundle> {
  if (!pending) {
    pending = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
      g.gsap.registerPlugin(st.ScrollTrigger);
      // The mobile URL bar resizes the viewport on every scroll direction change.
      st.ScrollTrigger.config({ ignoreMobileResize: true });
      bundle = { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger };
      // Lets the store runtime move Lenis onto the GSAP ticker, and the core
      // subscribe to scroll locks.
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('cx:gsap'));
      return bundle;
    });
    // A failed chunk may be retried by the next caller.
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

export function gsapIfLoaded(): GsapBundle | null {
  return bundle;
}
