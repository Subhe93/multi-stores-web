// Scroll-lock detection. The cart drawer, the mobile menu, the product
// lightbox (lib/scrollLock.ts) and the cookie dialog lock the page by inline
// styles on <body> / <html>; none of them is edited. One shared, ref-counted
// MutationObserver reports the changes to the engine (ScrollTrigger must not
// refresh while `body { position: fixed }` makes scrollY read 0) and to the
// store runtime (Lenis stops).

export type Cleanup = () => void;

const listeners = new Set<(locked: boolean) => void>();
let observer: MutationObserver | null = null;
let last = false;

export function isScrollLocked(): boolean {
  if (typeof document === 'undefined') return false;
  const body = document.body.style;
  return (
    body.overflow === 'hidden' || body.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
  );
}

function check() {
  const now = isScrollLocked();
  if (now === last) return;
  last = now;
  for (const cb of Array.from(listeners)) cb(now);
}

/** Calls `cb` whenever the page gets locked or unlocked. */
export function subscribeScrollLock(cb: (locked: boolean) => void): Cleanup {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  listeners.add(cb);
  if (!observer) {
    last = isScrollLocked();
    observer = new MutationObserver(check);
    const options = { attributes: true, attributeFilter: ['style'] };
    observer.observe(document.body, options);
    observer.observe(document.documentElement, options);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}
