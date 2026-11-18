// Magnetic pull for [data-cx-magnetic] buttons (contract 4.11). Store level:
// mounted by runtime/store.ts on brand pages of a store that switched
// creative motion on, for a fine pointer only.
//
// One delegated `pointerover` listener on the store root. While the pointer
// is over a target, a `pointermove` listener and one animation frame per
// move write --cx-mx / --cx-my on the target; the pill button's inner span
// consumes them (css/base.css.ts), so the link itself, its hit area and its
// focus ring never move. No GSAP, no scroll listener, nothing while idle.

import { MAGNETIC_EXCLUDE, MAGNETIC_SELECTOR } from '../constants';

/** Share of the pointer's distance from the button centre that the label follows. */
const PULL = 0.18;
/** Largest offset in px, per axis. */
const MAX_OFFSET = 8;

const cap = (n: number) => Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, n));

function magneticTarget(root: HTMLElement, node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest<HTMLElement>(MAGNETIC_SELECTOR);
  if (!el || !root.contains(el)) return null;
  // Never on buy controls, forms, the store chrome and dialogs.
  if (el.closest(MAGNETIC_EXCLUDE)) return null;
  if (el.matches(':disabled, [aria-disabled="true"]')) return null;
  return el;
}

export function mountMagnetic(root: HTMLElement): () => void {
  let target: HTMLElement | null = null;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const apply = () => {
    frame = 0;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const dx = cap((pointerX - (rect.left + rect.width / 2)) * PULL);
    const dy = cap((pointerY - (rect.top + rect.height / 2)) * PULL);
    target.style.setProperty('--cx-mx', `${dx.toFixed(2)}px`);
    target.style.setProperty('--cx-my', `${dy.toFixed(2)}px`);
  };

  const onMove = (e: PointerEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!frame) frame = requestAnimationFrame(apply);
  };

  const release = () => {
    if (!target) return;
    const el = target;
    target = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    root.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', release);
    el.removeEventListener('pointercancel', release);
    el.removeEventListener('blur', release);
    // The inner span's CSS transition eases the label back.
    el.style.removeProperty('--cx-mx');
    el.style.removeProperty('--cx-my');
  };

  const onOver = (e: PointerEvent) => {
    // Touch and pen never pull (the runtime also mounts for a fine pointer only).
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = magneticTarget(root, e.target);
    if (el === target) return;
    release();
    if (!el) return;
    target = el;
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('blur', release);
    root.addEventListener('pointermove', onMove, { passive: true });
    onMove(e);
  };

  root.addEventListener('pointerover', onOver, { passive: true });

  return () => {
    release();
    root.removeEventListener('pointerover', onOver);
  };
}
