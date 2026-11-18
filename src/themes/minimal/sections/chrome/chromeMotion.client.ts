'use client';

// Motion helpers of the store chrome (drawers, menus, cart badge). Used only
// when a component received the `motion` prop (store motion style on); every
// helper is inert otherwise, so a store without the switch behaves exactly as
// before.

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Same type as themes/creative/recipes MotionProp (kept local: no import into client chunks). */
export type ChromeMotion = 'intro' | 'scroll' | undefined;

/** Close time of a drawer (panel slides out, backdrop fades). */
export const DRAWER_EXIT_MS = 350;
/** Close time of a dropdown list. */
export const MENU_EXIT_MS = 200;

/**
 * The motion gate is open right now: JavaScript set html[data-cx-motion]
 * (visitor allows motion) and the store neither switched motion off nor is
 * this the builder preview. Same conditions as the CSS gate in
 * themes/creative/css/base.css.ts.
 */
export function chromeMotionLive(): boolean {
  if (typeof document === 'undefined') return false;
  if (!document.documentElement.hasAttribute('data-cx-motion')) return false;
  return document.querySelector('.store-root[data-motion-reveal="off"],.store-root[data-cx-builder]') === null;
}

/**
 * Keeps a closed overlay in the tree for `ms` so its exit can play. Returns
 * true while the overlay is closing. Always false without `motion` or while
 * the gate is shut: the overlay then unmounts at once, as it always did.
 */
export function useExit(open: boolean, motion: ChromeMotion, ms: number): boolean {
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // State derived from a prop change, adjusted during render (no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open && !!motion && chromeMotionLive());
  }
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setClosing(false), ms);
    return () => clearTimeout(timer);
  }, [closing, ms]);
  return closing;
}

const PULSE_FRAMES = [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }];
// The cart is restored from storage right after hydration: that first jump
// from 0 is not a change the visitor made.
const RESTORE_WINDOW_MS = 1500;

/**
 * Cart badge: one scale pulse (1 -> 1.15 -> 1 over 0.45 s) when the count
 * changes. Attach the returned ref to the badge element.
 */
export function useCountPulse<T extends HTMLElement>(count: number, motion: ChromeMotion): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const prev = useRef<number | null>(null);
  const born = useRef(0);
  useEffect(() => {
    if (prev.current === null) {
      prev.current = count;
      born.current = Date.now();
      return;
    }
    const before = prev.current;
    if (before === count) return;
    prev.current = count;
    if (!motion || !chromeMotionLive()) return;
    if (before === 0 && Date.now() - born.current < RESTORE_WINDOW_MS) return;
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate(PULSE_FRAMES, { duration: 450, easing: 'cubic-bezier(.65,0,.35,1)' });
  }, [count, motion]);
  return ref;
}
