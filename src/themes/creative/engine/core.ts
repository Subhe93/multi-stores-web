// Core of the creative engine. One async chunk without GSAP: it arms the
// scroll reveals of a section (CSS transitions + IntersectionObserver) and
// loads a behaviour module only when a section that names one comes close.
//
// Nothing here listens to scroll or resize events: observers only.

import { observeOnce } from '../../_motion/inView';
import { clearMotionFlag, motionForced, setMotionFlag } from '../motionFlag';
import { headerHeight, isBuilder, isCalm, isRtl, motionAllowed } from './env';
import { gsapIfLoaded, loadGsap, type GsapBundle } from './gsap';
import { BEHAVIORS, type BehaviorEntry } from './registry';
import { isScrollLocked, subscribeScrollLock } from './scrollGuard';

export type Cleanup = () => void;

export interface BehaviorContext {
  /** The [data-cx-section] element the behaviour belongs to. */
  scope: HTMLElement;
  rtl: boolean;
  /** Store motion profile "calm": no rotation, no arcs, softer values. */
  calm: boolean;
  loadGsap(): Promise<GsapBundle>;
  /** Debounced (200 ms) size change of the scope. Auto-removed with the scope. */
  onResize(cb: () => void): Cleanup;
  headerHeight(): number;
}

/**
 * A behaviour receives the element that carries data-cx-behavior. It may be
 * async (await ctx.loadGsap()); the cleanup it returns is called when the
 * scope unregisters, at once if that already happened.
 */
export type Behavior = (el: HTMLElement, ctx: BehaviorContext) => Cleanup | void | Promise<Cleanup | void>;

interface ScopeState {
  refs: number;
  dead: boolean;
  cleanups: Cleanup[];
}

const noop: Cleanup = () => {};
const scopes = new Map<HTMLElement, ScopeState>();

// Reveal line: an element shows when its top passes 78 % of the viewport.
const REVEAL_MARGIN = '0px 0px -22% 0px';
// Behaviours load when their scope is within 1.5 viewports.
const NEAR_MARGIN = '150% 0px 150% 0px';

// ── Shared services (alive while at least one scope is registered) ─────

let stopShared: Cleanup | null = null;
let inview: IntersectionObserver | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshQueued = false;

/** Debounced ScrollTrigger.refresh(); a no-op until GSAP is loaded, deferred while the page is scroll-locked. */
export function refresh(): void {
  if (!gsapIfLoaded()) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    const g = gsapIfLoaded();
    if (!g) return;
    if (isScrollLocked()) {
      refreshQueued = true;
      return;
    }
    refreshQueued = false;
    g.ScrollTrigger.refresh();
  }, 150);
}

function startShared(): void {
  if (stopShared) return;
  const offs: Cleanup[] = [];
  const root = document.querySelector<HTMLElement>('.store-root');
  const hasRO = typeof ResizeObserver !== 'undefined';

  // Height of the sticky / fixed store header, for sticky stages below it.
  const header = document.querySelector<HTMLElement>('#store-nav-header header');
  if (root && header && hasRO) {
    const write = () => {
      const position = window.getComputedStyle(header).position;
      const sticks = position === 'sticky' || position === 'fixed';
      root.style.setProperty('--cx-header-h', sticks ? `${Math.round(header.getBoundingClientRect().height)}px` : '0px');
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(header);
    offs.push(() => {
      ro.disconnect();
      root.style.removeProperty('--cx-header-h');
    });
  }

  // Layout changes that move trigger positions.
  let alive = true;
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (alive) refresh();
    });
  }
  if (document.readyState !== 'complete') {
    const onLoad = () => refresh();
    window.addEventListener('load', onLoad, { once: true });
    offs.push(() => window.removeEventListener('load', onLoad));
  }
  if (root && hasRO) {
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      refresh();
    });
    ro.observe(root);
    offs.push(() => ro.disconnect());
  }

  // data-cx-inview on every scope: CSS loops pause off-screen.
  if (typeof IntersectionObserver !== 'undefined') {
    inview = new IntersectionObserver((records) => {
      for (const r of records) r.target.toggleAttribute('data-cx-inview', r.isIntersecting);
    });
    offs.push(() => {
      inview?.disconnect();
      inview = null;
    });
  }

  // The visitor turns reduced motion on while the page is open.
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (query.matches && !motionForced()) {
        clearMotionFlag();
        revertAll();
      }
    };
    query.addEventListener?.('change', onChange);
    offs.push(() => query.removeEventListener?.('change', onChange));
  }

  // Scroll locks (cart drawer, menus, dialogs) freeze every ScrollTrigger:
  // lib/scrollLock.ts sets body { position: fixed; top: -y }, scrollY reads 0
  // and a live trigger would jump to its start state.
  let unsubscribeLock: Cleanup | null = null;
  let unlockFrame = 0;
  const onLock = (locked: boolean) => {
    const g = gsapIfLoaded();
    if (!g) return;
    cancelAnimationFrame(unlockFrame);
    if (locked) {
      for (const st of g.ScrollTrigger.getAll()) st.disable(false);
    } else {
      unlockFrame = requestAnimationFrame(() => {
        for (const st of g.ScrollTrigger.getAll()) st.enable(false);
        if (refreshQueued) refresh();
      });
    }
  };
  const bindLock = () => {
    if (!unsubscribeLock && gsapIfLoaded()) unsubscribeLock = subscribeScrollLock(onLock);
  };
  bindLock();
  window.addEventListener('cx:gsap', bindLock);
  offs.push(() => {
    window.removeEventListener('cx:gsap', bindLock);
    cancelAnimationFrame(unlockFrame);
    unsubscribeLock?.();
    unsubscribeLock = null;
  });

  stopShared = () => {
    alive = false;
    clearTimeout(refreshTimer);
    refreshQueued = false;
    for (const off of offs) off();
    stopShared = null;
  };
}

// ── Per-scope work ──────────────────────────────────────────────────────

function withSelf(scope: HTMLElement, selector: string): HTMLElement[] {
  const found = Array.from(scope.querySelectorAll<HTMLElement>(selector));
  if (scope.matches(selector)) found.unshift(scope);
  return found;
}

function armReveals(scope: HTMLElement, state: ScopeState): void {
  const els = withSelf(scope, '[data-cx-reveal]');
  if (!els.length) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  for (const el of els) {
    // Already armed through an outer scope.
    if (el.hasAttribute('data-cx-state')) continue;
    const top = el.getBoundingClientRect().top;
    // On screen or already scrolled past: stays at rest, never hidden.
    if (top < vh) continue;
    el.setAttribute('data-cx-state', 'pending');
    // The last block before the footer may never reach the reveal line:
    // observe it with no margin, or it would stay hidden.
    const topAtEnd = top + window.scrollY - maxScroll;
    const rootMargin = topAtEnd > vh * 0.78 ? '0px' : REVEAL_MARGIN;
    const stop = observeOnce(el, () => el.setAttribute('data-cx-state', 'shown'), { rootMargin });
    state.cleanups.push(() => {
      stop();
      el.removeAttribute('data-cx-state');
    });
  }
}

function makeContext(scope: HTMLElement, state: ScopeState, calm: boolean): BehaviorContext {
  return {
    scope,
    rtl: isRtl(scope),
    calm,
    loadGsap,
    headerHeight,
    onResize(cb) {
      if (typeof ResizeObserver === 'undefined') return noop;
      let first = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ro = new ResizeObserver(() => {
        if (first) {
          first = false;
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!state.dead) cb();
        }, 200);
      });
      ro.observe(scope);
      const stop = () => {
        clearTimeout(timer);
        ro.disconnect();
      };
      state.cleanups.push(stop);
      return stop;
    },
  };
}

function runBehavior(entry: BehaviorEntry, host: HTMLElement, scope: HTMLElement, state: ScopeState, calm: boolean) {
  entry
    .load()
    .then(async (mod) => {
      if (state.dead) return;
      const ctx = makeContext(scope, state, calm);
      let result: ReturnType<Behavior> = undefined;
      const g = gsapIfLoaded();
      if (g) {
        // Everything the behaviour creates synchronously belongs to a
        // context of the scope and is reverted with it.
        const context = g.gsap.context(() => {
          result = mod.default(host, ctx);
        }, scope);
        state.cleanups.push(() => context.revert());
      } else {
        result = mod.default(host, ctx);
      }
      const cleanup = await result;
      if (typeof cleanup !== 'function') return;
      // Resolved after the scope unregistered: clean up at once.
      if (state.dead) cleanup();
      else state.cleanups.push(cleanup);
    })
    // A failed chunk or a throwing behaviour leaves the static section.
    .catch(() => {});
}

function armBehaviors(scope: HTMLElement, state: ScopeState): void {
  const hosts = withSelf(scope, '[data-cx-behavior]');
  if (!hosts.length) return;
  const calm = isCalm();
  const start = () => {
    for (const host of hosts) {
      // Several behaviours may share one host: data-cx-behavior="scrub pointer".
      for (const name of (host.getAttribute('data-cx-behavior') || '').split(/\s+/)) {
        const entry = name ? BEHAVIORS[name] : undefined;
        if (!entry || (calm && !entry.calm)) continue;
        runBehavior(entry, host, scope, state, calm);
      }
    }
  };
  state.cleanups.push(observeOnce(scope, start, { rootMargin: NEAR_MARGIN }));
}

function release(scope: HTMLElement, force = false): void {
  const state = scopes.get(scope);
  if (!state) return;
  state.refs = force ? 0 : state.refs - 1;
  if (state.refs > 0) return;
  state.dead = true;
  scopes.delete(scope);
  for (const cleanup of state.cleanups.reverse()) {
    try {
      cleanup();
    } catch {
      // One failing cleanup must not keep the others from running.
    }
  }
  state.cleanups = [];
  // Safety net: a trigger a behaviour forgot would outlive its DOM.
  const g = gsapIfLoaded();
  if (g) {
    for (const st of g.ScrollTrigger.getAll()) {
      const trigger = st.trigger;
      if (trigger && scope.contains(trigger)) st.kill(true);
    }
  }
  inview?.unobserve(scope);
  scope.removeAttribute('data-cx-watch');
  scope.removeAttribute('data-cx-inview');
  for (const el of withSelf(scope, '[data-cx-live]')) el.removeAttribute('data-cx-live');
  if (scopes.size === 0) stopShared?.();
}

function revertAll(): void {
  for (const scope of Array.from(scopes.keys())) release(scope, true);
}

/**
 * Registers one [data-cx-section] element. Returns the cleanup that reverts
 * everything of that scope. A no-op when motion is not allowed (visitor
 * reduced motion, store motion off) or in the builder preview: the page then
 * stays in its static, complete state.
 */
export function register(scope: HTMLElement): Cleanup {
  setMotionFlag();
  if (!scope || !motionAllowed() || isBuilder()) return noop;
  let released = false;
  const off = () => {
    if (released) return;
    released = true;
    release(scope);
  };
  const existing = scopes.get(scope);
  if (existing) {
    existing.refs += 1;
    return off;
  }
  const state: ScopeState = { refs: 1, dead: false, cleanups: [] };
  scopes.set(scope, state);
  startShared();
  scope.setAttribute('data-cx-watch', '');
  inview?.observe(scope);
  armReveals(scope, state);
  armBehaviors(scope, state);
  return off;
}
