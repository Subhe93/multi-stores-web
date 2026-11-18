'use client';

// Motion of the flow pages (cart, checkout, account, sign-in): how a client
// page learns that the store switched its motion style on.
//
// The server layout of each route knows the store and wraps its children in
// FlowMotionProvider only when the switch is on; pages read the value with
// useFlowMotion() and hand it to the recipes (themes/creative/recipes.ts).
// Without the provider the hook returns undefined and every recipe returns
// an empty object, so the markup is what it was.
//
// Feedback that starts from a click (a removed cart line, a changed
// quantity) asks the document instead, at the time of the click
// (flowMotionLive): no prop and no render depends on it.

import { createContext, useContext, type ReactNode } from 'react';
import { rise, type MotionAttrs, type MotionProp } from '@/themes/creative/recipes';

const FlowMotionContext = createContext<MotionProp>(undefined);
const NO_ATTRS: MotionAttrs = Object.freeze({});

export function FlowMotionProvider({ value = 'scroll', children }: { value?: MotionProp; children: ReactNode }) {
  return <FlowMotionContext.Provider value={value}>{children}</FlowMotionContext.Provider>;
}

/** 'scroll' on a flow page of a store with the motion style on, else undefined. */
export function useFlowMotion(): MotionProp {
  return useContext(FlowMotionContext);
}

/**
 * Entrance of a page title and of the few blocks that follow it: plays once
 * when the element mounts (CSS only), with the fast timing of the surface.
 * `i` = step after the title (0.04 s each).
 */
export function enter(m: MotionProp, i = 0): MotionAttrs {
  return rise(m ? 'intro' : undefined, { i });
}

/**
 * The check mark of a placed order draws once (0.6 s, css/flow.css.ts). Put
 * it on the icon itself (an svg with a circle and a path).
 */
export function checkDraw(m: MotionProp): MotionAttrs {
  return m ? { 'data-cx-flow': 'check' } : NO_ATTRS;
}

/** Duration of the collapse of a removed cart line (css/flow.css.ts). */
export const LEAVE_MS = 250;

/**
 * True when motion really runs in this document right now: the store
 * switched its motion style on, the engine set its gate (JavaScript, no
 * reduced motion) and the store profile is not "off". Call it from event
 * handlers only, never during render.
 */
export function flowMotionLive(el?: Element | null): boolean {
  if (typeof document === 'undefined') return false;
  if (!document.documentElement.hasAttribute('data-cx-motion')) return false;
  const root = el ? el.closest('.store-root') : document.querySelector('.store-root');
  if (!root || !root.hasAttribute('data-creative')) return false;
  return root.getAttribute('data-motion-reveal') !== 'off' && !root.hasAttribute('data-cx-builder');
}

/**
 * Collapses a cart line (height and opacity, LEAVE_MS); `done` resolves when
 * it is closed. Returns null when motion does not run: the caller then
 * removes the line at once, as before. Otherwise it removes the line after
 * `done` and calls `restore` if that fails.
 */
export function collapseLine(el: HTMLElement | null): { done: Promise<void>; restore: () => void } | null {
  if (!el || !flowMotionLive(el)) return null;
  // A fixed start height, then the closed state on the next frame.
  el.style.blockSize = `${el.getBoundingClientRect().height}px`;
  void el.offsetHeight;
  el.setAttribute('data-cx-leave', '');
  const restore = () => {
    el.removeAttribute('data-cx-leave');
    el.style.removeProperty('block-size');
  };
  return { done: new Promise((resolve) => setTimeout(resolve, LEAVE_MS)), restore };
}
