// Environment probes of the creative engine (browser only).

import { storeMotionOff } from '../../_motion/inView';

const mq = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;

/** The gate is open (JavaScript + visitor allows motion, or the tab override) and the store did not switch motion off. */
export function motionAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute('data-cx-motion') && !storeMotionOff();
}

/** Store motion profile "calm". */
export function isCalm(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.store-root[data-motion-reveal="calm"]') !== null;
}

/** Dashboard builder preview: the engine never starts there. */
export function isBuilder(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.store-root[data-cx-builder]') !== null;
}

export function isDesktop(): boolean {
  return mq('(min-width: 1024px)');
}

export function finePointer(): boolean {
  return mq('(hover: hover) and (pointer: fine)');
}

/** Computed direction of the element (the store root carries `dir`, not <html>). */
export function isRtl(el: Element): boolean {
  return typeof window !== 'undefined' && window.getComputedStyle(el).direction === 'rtl';
}

/** Height of the sticky / fixed store header in px (--cx-header-h, written by the core). */
export function headerHeight(): number {
  if (typeof document === 'undefined') return 0;
  const root = document.querySelector<HTMLElement>('.store-root');
  const raw = root ? root.style.getPropertyValue('--cx-header-h') : '';
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
