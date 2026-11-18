// Store-level runtime of the creative switch: smooth scrolling (Lenis),
// magnetic buttons and the optional page curtain. Loaded by CreativeBoot
// (boot.client.tsx) only for a store that switched creative motion on, and
// active on brand pages only: on commerce pages everything is destroyed and
// no animation frame loop runs.

import { isBrandPath, isBrandSegment } from '../constants';
import type { CreativeOptions } from '../creativeAttrs';
import { clearMotionFlag, motionForced } from '../motionFlag';
import { refresh } from '../engine/core';
import { finePointer, headerHeight, isBuilder, isCalm, isDesktop, motionAllowed } from '../engine/env';
import { gsapIfLoaded } from '../engine/gsap';
import { createLenis, type LenisInstance } from '../engine/lenis';
import { isScrollLocked, subscribeScrollLock } from '../engine/scrollGuard';
import type { CurtainHandle } from './curtain';

declare global {
  interface Window {
    // `window.lenis` is reserved by the library itself.
    __lenis?: LenisInstance;
  }
}

type Cleanup = () => void;

export interface StoreRuntimeState {
  options: CreativeOptions;
  /** useSelectedLayoutSegment() of the store layout: null on the home page. */
  segment: string | null;
  pathname: string;
  curtainLabel: string;
  logoUrl?: string;
  push(href: string): void;
  prefetch(href: string): void;
}

let state: StoreRuntimeState | null = null;
let stopBase: Cleanup | null = null;
// History navigation (back / forward): the browser restores the position.
let popped = false;

// ── Lenis ───────────────────────────────────────────────────────────────

let lenis: LenisInstance | null = null;
let lenisTicket = 0;
let lenisLoading = false;
let stopLoop: Cleanup | null = null;
let stopLenisExtras: Cleanup | null = null;
let previousScrollBehavior = '';

function bindLoop(): void {
  if (!lenis) return;
  stopLoop?.();
  const instance = lenis;
  const g = gsapIfLoaded();
  if (g) {
    // One loop only: with GSAP on the page Lenis rides its ticker, so
    // ScrollTrigger reads the position Lenis just wrote.
    const onScroll = () => g.ScrollTrigger.update();
    const tick = (time: number) => instance.raf(time * 1000);
    instance.on('scroll', onScroll);
    g.gsap.ticker.add(tick);
    g.gsap.ticker.lagSmoothing(0);
    stopLoop = () => {
      instance.off('scroll', onScroll);
      g.gsap.ticker.remove(tick);
      g.gsap.ticker.lagSmoothing(500, 33);
      stopLoop = null;
    };
    return;
  }
  let frame = 0;
  const loop = (time: number) => {
    instance.raf(time);
    frame = requestAnimationFrame(loop);
  };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', onVisibility);
  stopLoop = () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onVisibility);
    stopLoop = null;
  };
}

function sameDocumentHash(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute('href') || '';
  if (!raw.includes('#')) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.pathname !== window.location.pathname || url.search !== window.location.search) return null;
  return url.hash.length > 1 ? url.hash : null;
}

function mountLenisExtras(instance: LenisInstance): Cleanup {
  // Scroll locks: the page must not glide under an open drawer or dialog.
  let unlockFrame = 0;
  const stopLock = subscribeScrollLock((locked) => {
    cancelAnimationFrame(unlockFrame);
    if (locked) {
      instance.stop();
    } else {
      unlockFrame = requestAnimationFrame(() => {
        instance.resize();
        instance.scrollTo(window.scrollY, { immediate: true, force: true });
        instance.start();
      });
    }
  });
  if (isScrollLocked()) instance.stop();

  // Same-page anchors: glide there, below the sticky header.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const hash = sameDocumentHash(anchor);
    if (!hash) return;
    let target: HTMLElement | null = null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      target = null;
    }
    if (!target) return;
    e.preventDefault();
    instance.scrollTo(target, { offset: -headerHeight(), force: true });
    window.history.replaceState(window.history.state, '', hash);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  document.addEventListener('click', onClick);

  return () => {
    cancelAnimationFrame(unlockFrame);
    stopLock();
    document.removeEventListener('click', onClick);
  };
}

function startLenis(): void {
  if (lenis || lenisLoading) return;
  lenisLoading = true;
  const ticket = ++lenisTicket;
  createLenis()
    .then((instance) => {
      lenisLoading = false;
      if (ticket !== lenisTicket) {
        instance.destroy();
        // Wanted again while the stale request was in flight.
        if (state) sync(state);
        return;
      }
      lenis = instance;
      window.__lenis = instance;
      // globals.css sets scroll-behavior: smooth on <html>; with Lenis the
      // page would then be animated twice.
      previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      bindLoop();
      stopLenisExtras = mountLenisExtras(instance);
    })
    .catch(() => {
      lenisLoading = false;
    });
}

function stopLenis(): void {
  lenisTicket += 1;
  if (!lenis) return;
  stopLoop?.();
  stopLenisExtras?.();
  stopLenisExtras = null;
  lenis.destroy();
  lenis = null;
  delete window.__lenis;
  document.documentElement.style.scrollBehavior = previousScrollBehavior;
}

// ── Magnetic buttons and curtain (separate chunks) ─────────────────────

let stopMagnetic: Cleanup | null = null;
let magneticTicket = 0;
let magneticLoading = false;

function startMagnetic(): void {
  if (stopMagnetic || magneticLoading) return;
  const root = document.querySelector<HTMLElement>('.store-root');
  if (!root) return;
  magneticLoading = true;
  const ticket = ++magneticTicket;
  import('./magnetic')
    .then((m) => {
      magneticLoading = false;
      if (ticket !== magneticTicket) return;
      stopMagnetic = m.mountMagnetic(root);
    })
    .catch(() => {
      magneticLoading = false;
    });
}

function endMagnetic(): void {
  magneticTicket += 1;
  stopMagnetic?.();
  stopMagnetic = null;
}

let curtain: CurtainHandle | null = null;
let curtainTicket = 0;
let curtainLoading = false;

function startCurtain(): void {
  if (curtain || curtainLoading || !state) return;
  curtainLoading = true;
  const ticket = ++curtainTicket;
  import('./curtain')
    .then((m) => {
      curtainLoading = false;
      if (ticket !== curtainTicket || !state) return;
      curtain = m.mountCurtain({
        // Always the router of the latest sync.
        push: (href) => state?.push(href),
        prefetch: (href) => state?.prefetch(href),
        isBrandPath,
        label: state.curtainLabel,
        logoUrl: state.logoUrl,
      });
    })
    .catch(() => {
      curtainLoading = false;
    });
}

function endCurtain(): void {
  curtainTicket += 1;
  curtain?.destroy();
  curtain = null;
}

// ── Lifecycle ───────────────────────────────────────────────────────────

function startBase(): void {
  if (stopBase) return;
  const offs: Cleanup[] = [];

  const onPop = () => {
    popped = true;
  };
  window.addEventListener('popstate', onPop);
  offs.push(() => window.removeEventListener('popstate', onPop));

  // GSAP arrived after Lenis: move Lenis onto its ticker.
  const onGsap = () => bindLoop();
  window.addEventListener('cx:gsap', onGsap);
  offs.push(() => window.removeEventListener('cx:gsap', onGsap));

  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (query.matches && !motionForced()) clearMotionFlag();
      if (state) sync(state);
    };
    query.addEventListener?.('change', onChange);
    offs.push(() => query.removeEventListener?.('change', onChange));
  }

  stopBase = () => {
    for (const off of offs) off();
    stopBase = null;
  };
}

function onNavigate(): void {
  const wasPop = popped;
  popped = false;
  curtain?.arrived();
  if (lenis) {
    const instance = lenis;
    if (wasPop || window.location.hash) {
      // The browser (or Next, for a hash) places the page: follow it.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (lenis === instance) instance.scrollTo(window.scrollY, { immediate: true, force: true });
        }),
      );
    } else {
      instance.scrollTo(0, { immediate: true, force: true });
    }
  }
  refresh();
}

/**
 * Applies the current route and options. Idempotent: called on mount and on
 * every segment / pathname change; creates or destroys each feature.
 */
export function sync(next: StoreRuntimeState): void {
  if (typeof window === 'undefined') return;
  const previous = state;
  state = next;
  startBase();

  const active = motionAllowed() && !isCalm() && !isBuilder();
  const brand = active && isBrandSegment(next.segment);
  const fine = finePointer();

  if (brand && next.options.smooth && fine && isDesktop()) startLenis();
  else stopLenis();

  if (brand && next.options.magnetic && fine) startMagnetic();
  else endMagnetic();

  if (brand && next.options.curtain) startCurtain();
  else endCurtain();

  if (previous && (previous.pathname !== next.pathname || previous.segment !== next.segment)) onNavigate();
}

/** Removes every listener, observer, ticker callback and instance. */
export function destroy(): void {
  stopLenis();
  endMagnetic();
  endCurtain();
  stopBase?.();
  state = null;
  popped = false;
}
