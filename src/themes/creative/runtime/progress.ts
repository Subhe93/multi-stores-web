// Scroll progress bar (store option `progress: 'bar'`, default off). Mounted
// by runtime/store.ts on brand and shop pages of a store that switched its
// motion style on.
//
// A 2 px line fixed to the top edge that grows from the inline start with
// the scroll position. One passive scroll listener and at most one animation
// frame per scroll event; no frame loop, no library. Decorative: out of the
// accessibility tree and never a pointer target. The node lives on <body>
// (like the curtain), so no transform or filter of the store can detach it
// from the viewport.

import { isScrollLocked } from '../engine/scrollGuard';

/** Pages with less scrolling than this (px) show no bar. */
const MIN_SCROLL = 120;

export function mountProgress(root: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};

  const tokens = window.getComputedStyle(root);
  const color =
    tokens.getPropertyValue('--theme-colors-accent').trim() ||
    tokens.getPropertyValue('--theme-colors-primary').trim() ||
    'currentColor';

  const bar = document.createElement('div');
  bar.setAttribute('data-cx-progress', '');
  bar.setAttribute('aria-hidden', 'true');
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: '2px',
    zIndex: '2147482000',
    background: color,
    transform: 'scaleX(0)',
    transformOrigin: '0 50%',
    opacity: '0',
    transition: 'opacity .35s ease',
    pointerEvents: 'none',
    willChange: 'transform',
  });
  document.body.appendChild(bar);

  let frame = 0;
  let last = -1;

  const update = () => {
    frame = 0;
    // A locked page reads scrollY 0 (the body is pinned): keep the last value.
    if (isScrollLocked()) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < MIN_SCROLL) {
      bar.style.opacity = '0';
      last = -1;
      return;
    }
    const value = Math.min(1, Math.max(0, window.scrollY / max));
    // The store root carries `dir` (not <html>): the line starts at its inline start.
    const origin = root.getAttribute('dir') === 'rtl' ? '100% 50%' : '0 50%';
    if (bar.style.transformOrigin !== origin) bar.style.transformOrigin = origin;
    bar.style.opacity = '1';
    if (value === last) return;
    last = value;
    bar.style.transform = `scaleX(${value.toFixed(4)})`;
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // The page grew or shrank (load more, an accordion, a client navigation).
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(root);
  }
  schedule();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    observer?.disconnect();
    observer = null;
    bar.remove();
  };
}
