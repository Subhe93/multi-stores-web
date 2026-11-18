// The one gate of the creative engine: html[data-cx-motion] means
// "JavaScript runs AND motion is allowed". Set by an inline script before
// the first creative section paints, and again by the client islands after
// a client-side navigation. Creative CSS hides or moves nothing without it.
//
// `?cx-motion=force` keeps the gate open for the current tab even when the
// operating system asks for reduced motion (preview aid, never advertised).
// It never overrides a store that switched its motion off: that test lives
// in the CSS gate selector and in engine/env.ts.

const KEY = 'cx-motion';
const ATTR = 'data-cx-motion';

/** Inline script body (rendered by primitives/JsFlag). Same logic as setMotionFlag. */
export const MOTION_FLAG_SCRIPT =
  "(function(){try{var d=document.documentElement,s=sessionStorage;if(location.search.indexOf('cx-motion=force')>-1)s.setItem('cx-motion','force');if(!matchMedia('(prefers-reduced-motion: reduce)').matches||s.getItem('cx-motion')==='force')d.setAttribute('data-cx-motion','')}catch(e){}})()";

/** The per-tab override is active. */
export function motionForced(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === 'force';
  } catch {
    return false;
  }
}

/** Sets the gate attribute when motion is allowed; returns whether it is set. */
export function setMotionFlag(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const d = document.documentElement;
    const s = window.sessionStorage;
    if (window.location.search.indexOf('cx-motion=force') > -1) s.setItem(KEY, 'force');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches || s.getItem(KEY) === 'force') {
      d.setAttribute(ATTR, '');
    }
    return d.hasAttribute(ATTR);
  } catch {
    return false;
  }
}

export function clearMotionFlag(): void {
  if (typeof document !== 'undefined') document.documentElement.removeAttribute(ATTR);
}
