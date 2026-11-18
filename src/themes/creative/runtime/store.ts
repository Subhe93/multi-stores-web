// Store-level runtime of the motion switch. Loaded by CreativeBoot
// (boot.client.tsx) only for a store that switched its motion style on.
// - Every page: the section scan (runtime/scan), which arms the reveals of
//   the sections the renderer marked. Observers only, no frame loop.
// - Brand and shop pages (home, content pages, product lists, product
//   pages): smooth scrolling (Lenis) on a desktop with a fine pointer.
// - Brand and shop pages: the optional scroll progress bar (passive).
// - Brand pages only: magnetic buttons, the optional page curtain and the
//   optional cursor dot.
// - Flow pages (cart, checkout, account, sign-in, legal): nothing but the
//   scan. No frame loop ever runs there.

import { isBrandPath, routeScope } from '../constants';
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

// ── Section scan ───────────────────────────────────────────────────────

let stopScan: Cleanup | null = null;
let scanTicket = 0;
let scanLoading = false;

function startSections(): void {
  if (stopScan || scanLoading) return;
  const root = document.querySelector<HTMLElement>('.store-root');
  if (!root) return;
  scanLoading = true;
  const ticket = ++scanTicket;
  import('./scan')
    .then((m) => {
      scanLoading = false;
      if (ticket !== scanTicket) return;
      stopScan = m.startScan(root);
    })
    .catch(() => {
      scanLoading = false;
    });
}

function endSections(): void {
  scanTicket += 1;
  stopScan?.();
  stopScan = null;
}

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
    // Always the page clock, never GSAP's own (seconds since GSAP started):
    // the loop moves onto this ticker while the page may be gliding, and a
    // change of clock would hand the running glide a negative time step and
    // freeze it for as long as the two clocks differ.
    const tick = () => instance.raf(performance.now());
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
  const loop = () => {
    instance.raf(performance.now());
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
  // A same-page link clicked inside an open drawer: glide once it closed.
  let pendingAnchor: HTMLElement | null = null;
  const glideTo = (target: HTMLElement) => {
    if (target.isConnected) instance.scrollTo(target, { offset: -headerHeight(), force: true });
  };

  // Scroll locks (cart drawer, mobile menu, lightbox, dialogs): the page
  // must not glide under them, and resumes exactly where it was.
  let unlockFrame = 0;
  const stopLock = subscribeScrollLock((locked) => {
    cancelAnimationFrame(unlockFrame);
    if (locked) {
      instance.stop();
    } else {
      // One frame later: lib/scrollLock.ts restores the position on release.
      unlockFrame = requestAnimationFrame(() => {
        instance.resize();
        instance.scrollTo(window.scrollY, { immediate: true, force: true });
        instance.start();
        const target = pendingAnchor;
        pendingAnchor = null;
        if (target) glideTo(target);
      });
    }
  });
  if (isScrollLocked()) instance.stop();

  // Same-page anchors: glide there, below the sticky header. Capture phase
  // and preventDefault only: the link's own handlers (a menu that closes)
  // still run, the browser and the router skip their instant jump.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download')) return;
    const frame = anchor.getAttribute('target');
    if (frame && frame !== '_self') return;
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
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
    // Inside an open drawer or menu the glide waits for the unlock.
    if (isScrollLocked()) pendingAnchor = target;
    else glideTo(target);
    // A pointer click keeps its focus. Keyboard activation (detail 0) moves
    // on to the target like the browser's own fragment navigation does.
    if (e.detail === 0) {
      const el = target;
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
      }
      el.focus({ preventScroll: true });
    }
  };
  document.addEventListener('click', onClick, true);

  // The address bar or back / forward moved between fragments of this page:
  // the browser placed the page, a running glide must not pull it back.
  let hashFrame = 0;
  const onHashChange = () => {
    cancelAnimationFrame(hashFrame);
    hashFrame = requestAnimationFrame(() => {
      if (!isScrollLocked()) instance.scrollTo(window.scrollY, { immediate: true, force: true });
    });
  };
  window.addEventListener('hashchange', onHashChange);

  return () => {
    cancelAnimationFrame(unlockFrame);
    cancelAnimationFrame(hashFrame);
    pendingAnchor = null;
    stopLock();
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('hashchange', onHashChange);
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

// ── Scroll progress bar and cursor dot (separate chunks) ───────────────

/** A feature that lives in its own chunk and mounts on the store root. */
function lazyFeature(load: () => Promise<(root: HTMLElement) => Cleanup>) {
  let stop: Cleanup | null = null;
  let ticket = 0;
  let loading = false;
  return {
    start(): void {
      if (stop || loading) return;
      loading = true;
      const mine = ++ticket;
      load()
        .then((mount) => {
          loading = false;
          if (mine !== ticket) {
            // Ended while the chunk was in flight; maybe wanted again since.
            if (state) sync(state);
            return;
          }
          const root = document.querySelector<HTMLElement>('.store-root');
          if (root) stop = mount(root);
        })
        .catch(() => {
          loading = false;
        });
    },
    end(): void {
      ticket += 1;
      stop?.();
      stop = null;
    },
  };
}

const progress = lazyFeature(() => import('./progress').then((m) => m.mountProgress));
const cursor = lazyFeature(() => import('./cursor').then((m) => m.mountCursor));

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

  // Reveals also run under the calm profile (softened in CSS).
  const allowed = motionAllowed() && !isBuilder();
  if (allowed) startSections();
  else endSections();

  const active = motionAllowed() && !isCalm() && !isBuilder();
  const scope = routeScope(next.segment);
  const brand = active && scope === 'brand';
  const fine = finePointer();

  if (active && scope !== 'flow' && next.options.smooth && fine && isDesktop()) startLenis();
  else stopLenis();

  if (brand && next.options.magnetic && fine) startMagnetic();
  else endMagnetic();

  if (brand && next.options.curtain) startCurtain();
  else endCurtain();

  // Like every option of the switch, the bar is off under the calm profile
  // (the builder says so next to the options).
  if (active && scope !== 'flow' && next.options.progress) progress.start();
  else progress.end();

  if (brand && next.options.cursor && fine) cursor.start();
  else cursor.end();

  if (previous && (previous.pathname !== next.pathname || previous.segment !== next.segment)) onNavigate();
}

/** Removes every listener, observer, ticker callback and instance. */
export function destroy(): void {
  endSections();
  stopLenis();
  endMagnetic();
  endCurtain();
  progress.end();
  cursor.end();
  stopBase?.();
  state = null;
  popped = false;
}
