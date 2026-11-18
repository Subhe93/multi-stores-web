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

// Reveal line: an element shows when its top passes 84 % of the viewport.
// The observed area reaches far above the viewport, so an element that a
// jump carried past (End key, anchor link, restored scroll position) is
// released too instead of staying pending until the visitor scrolls back.
const ABOVE = '100000px';
const REVEAL_MARGIN = `${ABOVE} 0px -16% 0px`;
const REVEAL_MARGIN_END = `${ABOVE} 0px 0px 0px`;
// A shown element goes back to its own styles after its entrance: the
// "shown" rule carries a transition that would otherwise override the
// element's hover transitions for good.
const SETTLE_MS = 3200;
// Stagger steps are capped: the tenth card must not wait a second.
const MAX_STEP = 5;
const LINE_STEP = 0.1;
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

/** Elements laid out on the same row share a top edge (2 px tolerance). */
function rowIndex(els: HTMLElement[]): number[] {
  const out: number[] = [];
  let rowTop = Number.NaN;
  let n = 0;
  for (const el of els) {
    const top = el.getBoundingClientRect().top;
    if (Number.isNaN(rowTop) || Math.abs(top - rowTop) > 2) {
      rowTop = top;
      n = 0;
    }
    out.push(Math.min(n++, MAX_STEP));
  }
  return out;
}

/** Marks an element the engine tagged itself, so the cleanup can untag it. */
function tag(el: HTMLElement, kind: string, state: ScopeState, step?: number): void {
  if (el.hasAttribute('data-cx-reveal') || el.hasAttribute('data-cx-intro')) return;
  el.setAttribute('data-cx-reveal', kind);
  el.setAttribute('data-cx-tagged', '');
  if (step) el.style.setProperty('--cx-i', String(step));
  state.cleanups.push(() => {
    el.removeAttribute('data-cx-reveal');
    el.removeAttribute('data-cx-tagged');
    el.style.removeProperty('--cx-i');
  });
}

/**
 * Recipe "cards-stagger": a container marked data-cx-reveal="stagger" hands
 * the entrance to its items ([data-cx-item] descendants, else its children).
 * Each item rises on its own when it enters, delayed by its place in its
 * row, so a long grid cascades row by row and never animates off screen.
 */
function expandStaggers(scope: HTMLElement, state: ScopeState): void {
  for (const group of withSelf(scope, '[data-cx-reveal="stagger"]')) {
    let items = Array.from(group.querySelectorAll<HTMLElement>('[data-cx-item]'));
    if (!items.length) items = Array.from(group.children) as HTMLElement[];
    items = items.filter((el) => !el.hasAttribute('data-cx-reveal') && !el.hasAttribute('hidden'));
    const steps = rowIndex(items);
    items.forEach((el, i) => tag(el, 'rise', state, steps[i]));
  }
}

const AUTO_SKIP = 'script,style,template,[hidden],[data-cx-anchor]';

/**
 * Default treatment of a section that carries data-cx-auto and no recipe of
 * its own: its content blocks rise softly one after the other, and a block
 * of three or more alike children (a card grid, a logo row) cascades.
 */
function autoTag(scope: HTMLElement, state: ScopeState): void {
  if (!scope.hasAttribute('data-cx-auto')) return;
  if (scope.querySelector('[data-cx-reveal],[data-cx-intro],[data-cx-section]')) return;
  const usable = (el: Element) => !el.matches(AUTO_SKIP);
  // Walk down through single-child wrappers to the first element with several blocks.
  let host: HTMLElement = scope;
  for (let depth = 0; depth < 6; depth++) {
    const kids = (Array.from(host.children) as HTMLElement[]).filter(usable);
    if (kids.length !== 1) break;
    host = kids[0];
  }
  const blocks = (Array.from(host.children) as HTMLElement[]).filter(usable).slice(0, 12);
  if (!blocks.length) {
    if (host !== scope) tag(host, 'rise', state);
    return;
  }
  blocks.forEach((block, i) => {
    const kids = (Array.from(block.children) as HTMLElement[]).filter(usable);
    const alike = kids.length >= 3 && kids.every((k) => k.tagName === kids[0].tagName);
    if (alike) tag(block, 'stagger', state);
    else tag(block, 'rise', state, Math.min(i, MAX_STEP));
  });
}

/** Recipe "heading-lines": words that share a line enter together, line after line. */
function groupLines(el: HTMLElement, state: ScopeState): void {
  const words = Array.from(el.querySelectorAll<HTMLElement>('.cx-wi'));
  if (words.length < 2) return;
  let line = -1;
  let lineTop = Number.NaN;
  for (const word of words) {
    const top = (word.parentElement || word).offsetTop;
    if (Number.isNaN(lineTop) || Math.abs(top - lineTop) > 2) {
      lineTop = top;
      line += 1;
    }
    word.style.setProperty('--cx-ld', `${(Math.min(line, MAX_STEP) * LINE_STEP).toFixed(2)}s`);
  }
  state.cleanups.push(() => {
    for (const word of words) word.style.removeProperty('--cx-ld');
  });
}

function armReveals(scope: HTMLElement, state: ScopeState): void {
  autoTag(scope, state);
  expandStaggers(scope, state);
  const els = withSelf(scope, '[data-cx-reveal]').filter((el) => el.getAttribute('data-cx-reveal') !== 'stagger');
  if (!els.length) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  for (const el of els) {
    // Already armed (through an outer scope or an earlier pass).
    if (el.hasAttribute('data-cx-state')) continue;
    const rect = el.getBoundingClientRect();
    const top = rect.top;
    // On screen or already scrolled past: stays at rest, never hidden. The
    // same goes for an element beside the viewport (a card further along a
    // swipe row): no vertical scroll would ever bring it to the reveal line.
    if (top < vh || (vw > 0 && rect.width > 0 && (rect.left >= vw || rect.right <= 0))) {
      el.setAttribute('data-cx-state', 'done');
      state.cleanups.push(() => el.removeAttribute('data-cx-state'));
      continue;
    }
    if (el.getAttribute('data-cx-reveal') === 'words') groupLines(el, state);
    el.setAttribute('data-cx-state', 'pending');
    // The last block before the footer may never reach the reveal line:
    // observe it with no margin, or it would stay hidden.
    const topAtEnd = top + window.scrollY - maxScroll;
    const rootMargin = topAtEnd > vh * 0.84 ? REVEAL_MARGIN_END : REVEAL_MARGIN;
    let settle: ReturnType<typeof setTimeout> | undefined;
    // A pending mask is clipped to nothing by its own clip-path. Some browsers
    // then report no intersection for it and the image would stay hidden, so
    // the unclipped parent (same box) is observed instead.
    const watched =
      el.getAttribute('data-cx-reveal') === 'mask' && el.parentElement ? el.parentElement : el;
    const stop = observeOnce(
      watched,
      () => {
        el.setAttribute('data-cx-state', 'shown');
        settle = setTimeout(() => el.setAttribute('data-cx-state', 'done'), SETTLE_MS);
      },
      { rootMargin },
    );
    state.cleanups.push(() => {
      stop();
      clearTimeout(settle);
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

/**
 * Arms what was added to a registered scope after its first pass (cards of a
 * "load more", a late client render). Elements already handled are skipped.
 */
export function rearm(scope: HTMLElement): void {
  const state = scopes.get(scope);
  if (state && !state.dead) armReveals(scope, state);
}

/** Whether the element is a registered scope. */
export function isRegistered(scope: HTMLElement): boolean {
  return scopes.has(scope);
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
