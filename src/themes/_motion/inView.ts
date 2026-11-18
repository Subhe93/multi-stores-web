// Shared IntersectionObserver plumbing for the motion primitives (Reveal,
// StaggerGroup, Counter). One observer per distinct option set, so a page
// with hundreds of animated elements still has only a few observers.

type Callback = () => void;

interface Entry {
  io: IntersectionObserver;
  callbacks: Map<Element, Callback>;
}

const observers = new Map<string, Entry>();

function getEntry(rootMargin: string, threshold: number): Entry {
  const key = `${rootMargin}|${threshold}`;
  let entry = observers.get(key);
  if (!entry) {
    const callbacks = new Map<Element, Callback>();
    const io = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (!r.isIntersecting) continue;
          const cb = callbacks.get(r.target);
          callbacks.delete(r.target);
          io.unobserve(r.target);
          cb?.();
        }
      },
      { rootMargin, threshold },
    );
    entry = { io, callbacks };
    observers.set(key, entry);
  }
  return entry;
}

/**
 * Calls `onEnter` once, the first time `el` intersects the viewport.
 * Returns a cleanup that stops observing. No-op without IntersectionObserver.
 */
export function observeOnce(
  el: Element,
  onEnter: Callback,
  { rootMargin = '0px', threshold = 0 }: { rootMargin?: string; threshold?: number } = {},
): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const { io, callbacks } = getEntry(rootMargin, threshold);
  callbacks.set(el, onEnter);
  io.observe(el);
  return () => {
    callbacks.delete(el);
    io.unobserve(el);
  };
}

/** True when the element is (at least partly) inside the viewport right now. */
export function isInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return r.top < vh && r.bottom > 0;
}

/**
 * The store switched its motion off (theme_customizations.motion.reveal =
 * 'off'): the store root carries data-motion-reveal="off". False on the
 * server and for every store that never set it.
 */
export function storeMotionOff(): boolean {
  return typeof document !== 'undefined'
    ? document.querySelector('.store-root[data-motion-reveal="off"]') !== null
    : false;
}

/**
 * No movement wanted: the visitor asked for reduced motion, or the store
 * switched motion off (false on the server / without matchMedia).
 */
export function prefersReducedMotion(): boolean {
  const visitor =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return visitor || storeMotionOff();
}
