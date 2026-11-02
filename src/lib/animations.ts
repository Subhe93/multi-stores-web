'use client';

// Shared GSAP / Lenis plumbing for the marketing site. Register plugins once,
// expose the timing vocabulary every section uses, and keep the page-reveal
// handshake that gates the hero intro until the first paint is ready.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import type Lenis from 'lenis';

let registered = false;
if (typeof window !== 'undefined' && !registered) {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  registered = true;
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

export const EASE = {
  out: 'power3.out',
  expo: 'expo.out',
  inOut: 'power2.inOut',
  soft: 'power2.out',
  in: 'power2.in',
  linear: 'none',
} as const;

export const DUR = { fast: 0.5, base: 0.9, slow: 1.4, hero: 1.6 } as const;
export const STAGGER = { tight: 0.06, base: 0.12, loose: 0.15 } as const;
export const DIST = { sm: 24, md: 56, lg: 96 } as const;

// `clamp()` keeps triggers in the last viewport (footer, final CTA) from
// never firing: without it those elements stay hidden on short pages.
export const TRIGGER = {
  reveal: 'clamp(top 78%)',
  early: 'clamp(top 88%)',
} as const;

declare global {
  interface Window {
    __lenis?: Lenis;
    __sdRevealed?: boolean;
  }
}

export function getLenis(): Lenis | undefined {
  return typeof window === 'undefined' ? undefined : window.__lenis;
}

export function scrollToAnchor(hash: string, offset = -72) {
  const target = document.querySelector(hash);
  if (!target) return;
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target as HTMLElement, { offset, force: true });
  } else {
    const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

export function fontsReady(): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return document.fonts.ready;
}

export function refreshScroll() {
  ScrollTrigger.refresh();
}

export function isFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Page-reveal handshake. There is no preloader: the layout marks the page
// revealed on first mount and the hero/header intros wait on it, with a
// fallback so a slow hydration never leaves the hero empty.
const revealCallbacks: Array<() => void> = [];

export function markRevealed() {
  if (typeof window === 'undefined' || window.__sdRevealed) return;
  window.__sdRevealed = true;
  revealCallbacks.splice(0).forEach((cb) => cb());
}

export function onPageReveal(cb: () => void, fallbackMs = 1200): () => void {
  if (typeof window !== 'undefined' && window.__sdRevealed) {
    cb();
    return () => {};
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  revealCallbacks.push(run);
  const timer = window.setTimeout(run, fallbackMs);
  return () => {
    window.clearTimeout(timer);
    const i = revealCallbacks.indexOf(run);
    if (i >= 0) revealCallbacks.splice(i, 1);
  };
}
