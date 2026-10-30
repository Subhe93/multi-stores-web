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

/** Visitor asked for reduced motion (false on the server / without matchMedia). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
