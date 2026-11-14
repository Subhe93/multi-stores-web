// Page scroll lock for full-screen overlays (image viewers / lightboxes).
//
// `body { overflow: hidden }` alone does not stop the page from scrolling
// here: globals.css gives <html> `overflow-x: clip`, so the body's overflow
// no longer propagates to the viewport and the document keeps scrolling on
// wheel / touch (QA 2026-11-14 #10). iOS Safari also ignores overflow on the
// body for touch scrolling. The robust lock pins the body with
// `position: fixed` at the current offset (so nothing jumps), hides overflow
// on both <html> and <body>, keeps the scrollbar's width as padding (no
// layout shift on desktop), and on release restores the exact scroll
// position (instantly: <html> has `scroll-behavior: smooth`).
//
// Locks are reference-counted, so nested or overlapping overlays (and React
// StrictMode's double effects) release the page only with the last unlock.

type Saved = {
  x: number;
  y: number;
  html: { overflow: string; scrollBehavior: string };
  body: {
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflow: string;
    paddingRight: string;
  };
};

let locks = 0;
let saved: Saved | null = null;

function apply(): void {
  const html = document.documentElement;
  const body = document.body;
  const x = window.scrollX || window.pageXOffset || 0;
  const y = window.scrollY || window.pageYOffset || 0;
  saved = {
    x,
    y,
    html: { overflow: html.style.overflow, scrollBehavior: html.style.scrollBehavior },
    body: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    },
  };
  // Scrollbar width (0 on touch devices / overlay scrollbars).
  const gap = Math.max(0, window.innerWidth - html.clientWidth);
  if (gap > 0) {
    const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + gap}px`;
  }
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
}

function release(): void {
  if (!saved) return;
  const html = document.documentElement;
  const body = document.body;
  const { x, y } = saved;
  html.style.overflow = saved.html.overflow;
  Object.assign(body.style, saved.body);
  // Jump back without the smooth-scroll animation, then restore it.
  html.style.scrollBehavior = 'auto';
  window.scrollTo(x, y);
  html.style.scrollBehavior = saved.html.scrollBehavior;
  saved = null;
}

/**
 * Locks page scrolling until the returned function is called. Safe to call
 * on the server (no-op) and idempotent per returned unlock.
 */
export function lockScroll(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => undefined;
  if (locks === 0) apply();
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) release();
  };
}

/** Test helper: whether a lock is active. */
export function isScrollLocked(): boolean {
  return locks > 0;
}
