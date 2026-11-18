import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Behavior } from './core';

// ── Browser stubs ───────────────────────────────────────────────────────

class FakeIO {
  static all: FakeIO[] = [];
  els = new Set<Element>();
  disconnected = false;
  constructor(
    private cb: IntersectionObserverCallback,
    public options?: IntersectionObserverInit,
  ) {
    FakeIO.all.push(this);
  }
  observe(el: Element) {
    this.els.add(el);
  }
  unobserve(el: Element) {
    this.els.delete(el);
  }
  disconnect() {
    this.els.clear();
    this.disconnected = true;
  }
  fire(el: Element, isIntersecting = true) {
    this.cb([{ target: el, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

/** The element scrolls into view for every observer that watches it. */
function enter(el: Element) {
  for (const io of [...FakeIO.all]) if (io.els.has(el)) io.fire(el);
}
const observed = (el: Element) => FakeIO.all.some((io) => io.els.has(el));

class FakeRO {
  static all: FakeRO[] = [];
  els = new Set<Element>();
  disconnected = false;
  constructor(public cb: ResizeObserverCallback) {
    FakeRO.all.push(this);
  }
  observe(el: Element) {
    this.els.add(el);
  }
  unobserve(el: Element) {
    this.els.delete(el);
  }
  disconnect() {
    this.els.clear();
    this.disconnected = true;
  }
}

interface MediaListener {
  query: string;
  fn: () => void;
}
let reduceMotion = false;
let mediaListeners: MediaListener[] = [];

function stubBrowser() {
  FakeIO.all = [];
  FakeRO.all = [];
  mediaListeners = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return query.includes('prefers-reduced-motion') ? reduceMotion : false;
      },
      addEventListener: (_: string, fn: () => void) => mediaListeners.push({ query, fn }),
      removeEventListener: (_: string, fn: () => void) => {
        mediaListeners = mediaListeners.filter((l) => l.fn !== fn);
      },
    })),
  );
}

/** A store root with one creative section holding two reveal elements and a behaviour host. */
function mountSection(rootAttrs: Record<string, string> = {}) {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'store-root';
  for (const [k, v] of Object.entries(rootAttrs)) root.setAttribute(k, v);
  root.innerHTML = `
    <div id="store-nav-header"><header style="position: sticky">nav</header></div>
    <main>
      <section data-cx-section="demo">
        <h2><span class="cx-ht" data-cx-reveal="words" id="near">Near</span></h2>
        <div data-cx-reveal="rise" id="far">Far</div>
        <div data-cx-behavior="probe" id="host"></div>
      </section>
    </main>`;
  document.body.appendChild(root);
  const scope = root.querySelector('[data-cx-section]') as HTMLElement;
  const near = root.querySelector('#near') as HTMLElement;
  const far = root.querySelector('#far') as HTMLElement;
  const host = root.querySelector('#host') as HTMLElement;
  // jsdom has no layout: place "near" on screen and "far" below the fold.
  near.getBoundingClientRect = () => ({ top: 100, bottom: 140 }) as DOMRect;
  far.getBoundingClientRect = () => ({ top: 3000, bottom: 3100 }) as DOMRect;
  return { root, scope, near, far, host };
}

async function loadCore() {
  vi.resetModules();
  const core = await import('./core');
  const registry = await import('./registry');
  return { ...core, BEHAVIORS: registry.BEHAVIORS };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('creative engine core', () => {
  beforeEach(() => {
    reduceMotion = false;
    stubBrowser();
    window.sessionStorage.clear();
    document.documentElement.removeAttribute('data-cx-motion');
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-cx-motion');
  });

  it('arms only what is below the viewport, shows it on entry, and cleans up completely', async () => {
    const { scope, near, far, root } = mountSection();
    const { register } = await loadCore();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');

    const off = register(scope);
    expect(document.documentElement.hasAttribute('data-cx-motion')).toBe(true);
    // On screen: never hidden (marked as done, so a later pass leaves it alone).
    expect(near.getAttribute('data-cx-state')).toBe('done');
    expect(far.getAttribute('data-cx-state')).toBe('pending');
    expect(scope.hasAttribute('data-cx-watch')).toBe(true);
    expect(root.style.getPropertyValue('--cx-header-h')).toBe('0px');

    enter(far);
    expect(far.getAttribute('data-cx-state')).toBe('shown');

    off();
    expect(far.hasAttribute('data-cx-state')).toBe(false);
    expect(near.hasAttribute('data-cx-state')).toBe(false);
    expect(scope.hasAttribute('data-cx-watch')).toBe(false);
    expect(scope.hasAttribute('data-cx-inview')).toBe(false);
    expect(root.style.getPropertyValue('--cx-header-h')).toBe('');
    // No element is observed any more; engine-owned observers are gone.
    for (const el of [scope, near, far]) expect(observed(el)).toBe(false);
    for (const ro of FakeRO.all) expect(ro.disconnected).toBe(true);
    expect(mediaListeners).toHaveLength(0);
    // Every window listener that was added has been removed.
    const balance = new Map<string, number>();
    for (const [type] of added.mock.calls) balance.set(type, (balance.get(type) || 0) + 1);
    for (const [type] of removed.mock.calls) balance.set(type, (balance.get(type) || 0) - 1);
    for (const [type, n] of balance) expect(n, type).toBeLessThanOrEqual(0);
    // Calling the cleanup again is harmless.
    expect(() => off()).not.toThrow();
    added.mockRestore();
    removed.mockRestore();
  });

  it('toggles data-cx-inview through the shared observer', async () => {
    const { scope } = mountSection();
    const { register } = await loadCore();
    const off = register(scope);
    const io = FakeIO.all.find((o) => o.els.has(scope) && !o.options?.rootMargin) as FakeIO;
    io.fire(scope, true);
    expect(scope.hasAttribute('data-cx-inview')).toBe(true);
    io.fire(scope, false);
    expect(scope.hasAttribute('data-cx-inview')).toBe(false);
    off();
  });

  it('arms nothing under reduced motion', async () => {
    reduceMotion = true;
    const { scope, far } = mountSection();
    const { register } = await loadCore();
    const off = register(scope);
    expect(document.documentElement.hasAttribute('data-cx-motion')).toBe(false);
    expect(far.hasAttribute('data-cx-state')).toBe(false);
    expect(scope.hasAttribute('data-cx-watch')).toBe(false);
    expect(FakeIO.all).toHaveLength(0);
    off();
  });

  it('the per-tab override runs the engine under reduced motion', async () => {
    reduceMotion = true;
    window.sessionStorage.setItem('cx-motion', 'force');
    const { scope, far } = mountSection();
    const { register } = await loadCore();
    const off = register(scope);
    expect(far.getAttribute('data-cx-state')).toBe('pending');
    off();
  });

  it('arms nothing when the store switched motion off, even with the override', async () => {
    window.sessionStorage.setItem('cx-motion', 'force');
    const { scope, far } = mountSection({ 'data-motion-reveal': 'off' });
    const { register } = await loadCore();
    register(scope);
    expect(far.hasAttribute('data-cx-state')).toBe(false);
    expect(scope.hasAttribute('data-cx-watch')).toBe(false);
  });

  it('arms nothing in the builder preview', async () => {
    const { scope, far } = mountSection({ 'data-cx-builder': '' });
    const { register } = await loadCore();
    register(scope);
    expect(far.hasAttribute('data-cx-state')).toBe(false);
    expect(scope.hasAttribute('data-cx-watch')).toBe(false);
  });

  it('reverts every scope when the visitor turns reduced motion on', async () => {
    const { scope, far } = mountSection();
    const { register } = await loadCore();
    register(scope);
    expect(far.getAttribute('data-cx-state')).toBe('pending');
    reduceMotion = true;
    for (const l of [...mediaListeners]) l.fn();
    expect(document.documentElement.hasAttribute('data-cx-motion')).toBe(false);
    expect(far.hasAttribute('data-cx-state')).toBe(false);
    expect(scope.hasAttribute('data-cx-watch')).toBe(false);
  });

  it('loads a behaviour only when its scope comes near, and runs its cleanup', async () => {
    const { scope, host } = mountSection();
    const { register, BEHAVIORS } = await loadCore();
    const cleanup = vi.fn();
    const behavior = vi.fn<Behavior>((el, ctx) => {
      expect(el).toBe(host);
      expect(ctx.scope).toBe(scope);
      expect(ctx.rtl).toBe(false);
      expect(ctx.calm).toBe(false);
      el.setAttribute('data-cx-live', '');
      return cleanup;
    });
    const load = vi.fn(async () => ({ default: behavior }));
    BEHAVIORS.probe = { calm: false, load };

    const off = register(scope);
    expect(load).not.toHaveBeenCalled();
    enter(scope);
    expect(load).toHaveBeenCalledTimes(1);
    await tick();
    expect(behavior).toHaveBeenCalledTimes(1);

    off();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(host.hasAttribute('data-cx-live')).toBe(false);
  });

  it('calls a cleanup that resolves after the scope unregistered at once', async () => {
    const { scope } = mountSection();
    const { register, BEHAVIORS } = await loadCore();
    const cleanup = vi.fn();
    let finish: (c: () => void) => void = () => {};
    const behavior: Behavior = () => new Promise((resolve) => (finish = resolve));
    BEHAVIORS.probe = { calm: false, load: async () => ({ default: behavior }) };

    const off = register(scope);
    enter(scope);
    await tick();
    off();
    expect(cleanup).not.toHaveBeenCalled();
    finish(cleanup);
    await tick();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('never starts a behaviour whose module arrives after unregistering', async () => {
    const { scope } = mountSection();
    const { register, BEHAVIORS } = await loadCore();
    const behavior = vi.fn<Behavior>(() => {});
    let arrive: (m: { default: Behavior }) => void = () => {};
    BEHAVIORS.probe = { calm: false, load: () => new Promise((resolve) => (arrive = resolve)) };

    const off = register(scope);
    enter(scope);
    off();
    arrive({ default: behavior });
    await tick();
    expect(behavior).not.toHaveBeenCalled();
  });

  it('calm profile: reveals run, non-calm behaviours are skipped, calm ones get ctx.calm', async () => {
    const { scope, far, host } = mountSection({ 'data-motion-reveal': 'calm' });
    host.setAttribute('data-cx-behavior', 'probe gentle');
    const { register, BEHAVIORS } = await loadCore();
    const lively = vi.fn<Behavior>(() => {});
    const gentle = vi.fn<Behavior>((_el, ctx) => {
      expect(ctx.calm).toBe(true);
    });
    BEHAVIORS.probe = { calm: false, load: async () => ({ default: lively }) };
    BEHAVIORS.gentle = { calm: true, load: async () => ({ default: gentle }) };

    const off = register(scope);
    expect(far.getAttribute('data-cx-state')).toBe('pending');
    enter(scope);
    await tick();
    expect(lively).not.toHaveBeenCalled();
    expect(gentle).toHaveBeenCalledTimes(1);
    off();
  });

  it('a failing chunk or a throwing behaviour leaves the section static and the others running', async () => {
    const { scope, host } = mountSection();
    host.setAttribute('data-cx-behavior', 'broken thrower probe unknown');
    const { register, BEHAVIORS } = await loadCore();
    const ok = vi.fn<Behavior>(() => {});
    BEHAVIORS.broken = { calm: false, load: () => Promise.reject(new Error('chunk')) };
    BEHAVIORS.thrower = {
      calm: false,
      load: async () => ({
        default: () => {
          throw new Error('boom');
        },
      }),
    };
    BEHAVIORS.probe = { calm: false, load: async () => ({ default: ok }) };

    const off = register(scope);
    enter(scope);
    await tick();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(() => off()).not.toThrow();
  });

  it('onResize is debounced, skips the initial observer call and dies with the scope', async () => {
    vi.useFakeTimers();
    try {
      const { scope } = mountSection();
      const { register, BEHAVIORS } = await loadCore();
      const onResize = vi.fn();
      BEHAVIORS.probe = {
        calm: false,
        load: async () => ({
          default: (_el, ctx) => {
            ctx.onResize(onResize);
          },
        }),
      };
      const off = register(scope);
      enter(scope);
      await vi.advanceTimersByTimeAsync(0);
      const ro = FakeRO.all.find((r) => r.els.has(scope)) as FakeRO;
      const fire = () => ro.cb([], ro as unknown as ResizeObserver);
      fire(); // initial call of a real ResizeObserver
      await vi.advanceTimersByTimeAsync(250);
      expect(onResize).not.toHaveBeenCalled();
      fire();
      fire();
      await vi.advanceTimersByTimeAsync(199);
      expect(onResize).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);
      expect(onResize).toHaveBeenCalledTimes(1);
      fire();
      off();
      await vi.advanceTimersByTimeAsync(500);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(ro.disconnected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('registering the same scope twice is ref-counted', async () => {
    const { scope, far } = mountSection();
    const { register } = await loadCore();
    const a = register(scope);
    const b = register(scope);
    a();
    expect(far.getAttribute('data-cx-state')).toBe('pending');
    b();
    expect(far.hasAttribute('data-cx-state')).toBe(false);
  });

  it('refresh() is a no-op until GSAP is loaded', async () => {
    const { refresh } = await loadCore();
    expect(() => refresh()).not.toThrow();
  });
});
