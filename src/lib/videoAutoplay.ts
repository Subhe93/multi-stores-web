// Muted autoplay rules for product and story videos (product-video
// CONTRACT-AUTOPLAY A3 / 6.3). Pure helpers and hooks, no JSX.
//
// - autoplayBlockedByUser: reduced motion, Save-Data and slow connections
//   never autoplay (the poster stays).
// - registerAutoplay: a page-wide coordinator; at most one video autoplays,
//   the most visible one (>= 50 % in view). Hidden tab -> nobody.
// - holdAutoplay: a user-started player or the open lightbox pauses every
//   autoplaying video until all holds are released.
//
// Module state lives only in the browser; on the server (or without
// IntersectionObserver) registration is a no-op and nothing autoplays.

import { useSyncExternalStore } from 'react';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?(type: 'change', cb: () => void): void;
  removeEventListener?(type: 'change', cb: () => void): void;
}

function connection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Reduced motion, Save-Data, slow connection: autoplay must not start. */
export function autoplayBlockedByUser(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches) return true;
  } catch {
    // matchMedia unsupported: treat as no preference.
  }
  const conn = connection();
  if (conn?.saveData === true) return true;
  return conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g';
}

function subscribeBlocked(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let mql: MediaQueryList | null = null;
  try {
    mql = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null;
  } catch {
    mql = null;
  }
  mql?.addEventListener?.('change', onChange);
  const conn = connection();
  conn?.addEventListener?.('change', onChange);
  return () => {
    mql?.removeEventListener?.('change', onChange);
    conn?.removeEventListener?.('change', onChange);
  };
}

/** useSyncExternalStore hook over the same signals (server snapshot: true = blocked). */
export function useAutoplayBlocked(): boolean {
  return useSyncExternalStore(subscribeBlocked, autoplayBlockedByUser, () => true);
}

// ── Coordinator ──

interface Candidate {
  el: HTMLElement;
  ratio: number;
  onGrant(granted: boolean): void;
}

const candidates = new Map<string, Candidate>();
let observer: IntersectionObserver | null = null;
let winner: string | null = null;
let holds = 0;
let visibilityBound = false;

/** Minimum share of the video in view before it may autoplay. */
const MIN_RATIO = 0.5;

function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function documentOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b || typeof a.compareDocumentPosition !== 'function') return 0;
  // DOCUMENT_POSITION_FOLLOWING (4): b comes after a.
  return a.compareDocumentPosition(b) & 4 ? -1 : 1;
}

function evaluate(): void {
  let next: string | null = null;
  if (holds === 0 && !pageHidden()) {
    let best: Candidate | null = null;
    for (const [id, c] of candidates) {
      if (c.ratio < MIN_RATIO) continue;
      if (
        !best ||
        c.ratio > best.ratio + 1e-6 ||
        (Math.abs(c.ratio - best.ratio) <= 1e-6 && documentOrder(c.el, best.el) < 0)
      ) {
        best = c;
        next = id;
      }
    }
  }
  if (next === winner) return;
  const previous = winner;
  winner = next;
  if (previous) candidates.get(previous)?.onGrant(false);
  if (next) candidates.get(next)?.onGrant(true);
}

function onVisibility(): void {
  evaluate();
}

function ensureObserver(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof IntersectionObserver === 'undefined') return null;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        for (const c of candidates.values()) {
          if (c.el === entry.target) c.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
        }
      }
      evaluate();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    visibilityBound = true;
  }
  return observer;
}

/**
 * Page-wide coordinator: at most one autoplaying video, the most visible one
 * (ratio >= 0.5; tie: earlier in document order). `onGrant(true)` starts the
 * winner, `onGrant(false)` stops the previous one. Returns the unregister
 * function (a no-op without IntersectionObserver).
 */
export function registerAutoplay(id: string, el: HTMLElement, onGrant: (granted: boolean) => void): () => void {
  const io = ensureObserver();
  if (!io) return () => {};
  candidates.set(id, { el, ratio: 0, onGrant });
  io.observe(el);
  return () => {
    const c = candidates.get(id);
    if (!c || c.el !== el) return;
    candidates.delete(id);
    io.unobserve(el);
    if (winner === id) {
      winner = null;
      evaluate();
    }
    if (candidates.size === 0) {
      io.disconnect();
      observer = null;
      if (visibilityBound && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
        visibilityBound = false;
      }
    }
  };
}

/**
 * A user-started video or the open lightbox holds autoplay: nobody is
 * granted until every hold is released. Returns the release function
 * (idempotent).
 */
export function holdAutoplay(): () => void {
  holds += 1;
  evaluate();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    evaluate();
  };
}

/** Test helper: forget every registration and hold. */
export function __resetAutoplayForTests(): void {
  candidates.clear();
  observer?.disconnect();
  observer = null;
  winner = null;
  holds = 0;
  if (visibilityBound && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
  visibilityBound = false;
}
