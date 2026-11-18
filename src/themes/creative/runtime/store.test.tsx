import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreRuntimeState } from './store';

// ── Mocks: Lenis and the two B4 chunks ──────────────────────────────────

interface FakeLenis {
  raf: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}
const lenisInstances: FakeLenis[] = [];
const createLenis = vi.fn(async () => {
  const instance: FakeLenis = {
    raf: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    resize: vi.fn(),
    scrollTo: vi.fn(),
    destroy: vi.fn(),
  };
  lenisInstances.push(instance);
  return instance;
});
vi.mock('../engine/lenis', () => ({ createLenis: () => createLenis() }));

// GSAP is absent until a test "loads" it.
const ticker = { add: vi.fn(), remove: vi.fn(), lagSmoothing: vi.fn() };
const scrollTriggerUpdate = vi.fn();
let gsapLoaded = false;
vi.mock('../engine/gsap', () => ({
  gsapIfLoaded: () => (gsapLoaded ? { gsap: { ticker }, ScrollTrigger: { update: scrollTriggerUpdate, refresh: vi.fn() } } : null),
  loadGsap: () => Promise.reject(new Error('not in this test')),
}));

const unmountMagnetic = vi.fn();
const mountMagnetic = vi.fn((root: HTMLElement) => {
  void root;
  return unmountMagnetic;
});
vi.mock('./magnetic', () => ({ mountMagnetic: (root: HTMLElement) => mountMagnetic(root) }));

const stopScan = vi.fn();
const startScan = vi.fn((root: HTMLElement) => {
  void root;
  return stopScan;
});
vi.mock('./scan', () => ({ startScan: (root: HTMLElement) => startScan(root) }));

const curtainHandle = { arrived: vi.fn(), destroy: vi.fn() };
const mountCurtain = vi.fn((opts: unknown) => {
  void opts;
  return curtainHandle;
});
vi.mock('./curtain', () => ({ mountCurtain: (opts: unknown) => mountCurtain(opts) }));

const unmountProgress = vi.fn();
const mountProgress = vi.fn((root: HTMLElement) => {
  void root;
  return unmountProgress;
});
vi.mock('./progress', () => ({ mountProgress: (root: HTMLElement) => mountProgress(root) }));

const unmountCursor = vi.fn();
const mountCursor = vi.fn((root: HTMLElement) => {
  void root;
  return unmountCursor;
});
vi.mock('./cursor', () => ({ mountCursor: (root: HTMLElement) => mountCursor(root) }));

// ── Environment ─────────────────────────────────────────────────────────

const env = { reduce: false, fine: true, desktop: true };
// Listeners of the reduced-motion query, to switch it mid-session.
const reduceListeners = new Set<() => void>();
const everything = { smooth: true, magnetic: true, curtain: true, progress: true, cursor: true };
function stubMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        if (query.includes('prefers-reduced-motion')) return env.reduce;
        if (query.includes('pointer: fine')) return env.fine;
        if (query.includes('min-width: 1024px')) return env.desktop;
        return false;
      },
      addEventListener: (_type: string, cb: () => void) => {
        if (query.includes('prefers-reduced-motion')) reduceListeners.add(cb);
      },
      removeEventListener: (_type: string, cb: () => void) => {
        reduceListeners.delete(cb);
      },
    })),
  );
}

function mountRoot(attrs: Record<string, string> = {}) {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'store-root';
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
  document.body.appendChild(root);
  return root;
}

const state = (over: Partial<StoreRuntimeState> = {}): StoreRuntimeState => ({
  options: { smooth: true, magnetic: true, curtain: false, progress: false, cursor: false },
  segment: null,
  pathname: '/',
  curtainLabel: 'Loading page',
  push: vi.fn(),
  prefetch: vi.fn(),
  ...over,
});

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

async function loadRuntime() {
  vi.resetModules();
  return import('./store');
}

describe('store runtime', () => {
  beforeEach(() => {
    env.reduce = false;
    env.fine = true;
    env.desktop = true;
    lenisInstances.length = 0;
    gsapLoaded = false;
    reduceListeners.clear();
    window.history.replaceState(null, '', '/');
    vi.clearAllMocks();
    stubMedia();
    document.documentElement.setAttribute('data-cx-motion', '');
    document.documentElement.style.scrollBehavior = '';
    mountRoot();
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-cx-motion');
    document.documentElement.style.scrollBehavior = '';
    delete window.__lenis;
    document.body.style.overflow = '';
    document.body.innerHTML = '';
  });

  it('brand page on a desktop with a fine pointer: Lenis and magnetic start', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    expect(createLenis).toHaveBeenCalledTimes(1);
    expect(window.__lenis).toBe(lenisInstances[0]);
    expect(document.documentElement.style.scrollBehavior).toBe('auto');
    expect(mountMagnetic).toHaveBeenCalledTimes(1);
    expect(mountMagnetic).toHaveBeenCalledWith(document.querySelector('.store-root'));
    expect(mountCurtain).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('sync is idempotent: no second instance', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    runtime.sync(state());
    await settle();
    runtime.sync(state());
    await settle();
    expect(createLenis).toHaveBeenCalledTimes(1);
    expect(mountMagnetic).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it.each(['products', 'collections'])(
    'shop segment %s: smooth scrolling and the section scan, no magnetic pull, no curtain',
    async (segment) => {
      const runtime = await loadRuntime();
      runtime.sync(state({ segment, pathname: `/${segment}`, options: { smooth: true, magnetic: true, curtain: true, progress: false, cursor: false } }));
      await settle();
      expect(startScan).toHaveBeenCalledTimes(1);
      expect(createLenis).toHaveBeenCalledTimes(1);
      expect(mountMagnetic).not.toHaveBeenCalled();
      expect(mountCurtain).not.toHaveBeenCalled();
      runtime.destroy();
      expect(stopScan).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['cart', '(checkout)', 'account', 'auth', 'legal'])(
    'flow segment %s: only the section scan starts (no frame loop)',
    async (segment) => {
      const runtime = await loadRuntime();
      runtime.sync(state({ segment, pathname: `/${segment}`, options: { smooth: true, magnetic: true, curtain: true, progress: false, cursor: false } }));
      await settle();
      expect(startScan).toHaveBeenCalledTimes(1);
      expect(createLenis).not.toHaveBeenCalled();
      expect(mountMagnetic).not.toHaveBeenCalled();
      expect(mountCurtain).not.toHaveBeenCalled();
      expect(window.__lenis).toBeUndefined();
      runtime.destroy();
    },
  );

  it('touch device: no Lenis, no magnetic', async () => {
    env.fine = false;
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    expect(mountMagnetic).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('narrow viewport: no Lenis', async () => {
    env.desktop = false;
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('calm profile: nothing starts', async () => {
    mountRoot({ 'data-motion-reveal': 'calm' });
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: true, curtain: true, progress: false, cursor: false } }));
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    expect(mountMagnetic).not.toHaveBeenCalled();
    expect(mountCurtain).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it.each([
    ['store motion off', { 'data-motion-reveal': 'off' }, true],
    ['builder preview', { 'data-cx-builder': '' }, true],
    ['reduced motion (no gate attribute)', {}, false],
  ])('%s: nothing starts', async (_name, attrs, flagged) => {
    mountRoot(attrs as Record<string, string>);
    if (!flagged) document.documentElement.removeAttribute('data-cx-motion');
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    expect(mountMagnetic).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('options off: smooth and magnetic stay off', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: false, magnetic: false, curtain: false, progress: false, cursor: false } }));
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    expect(mountMagnetic).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('destroy restores scroll-behavior, deletes window.__lenis and unmounts everything', async () => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: true, curtain: true, progress: false, cursor: false } }));
    await settle();
    expect(document.documentElement.style.scrollBehavior).toBe('auto');
    expect(mountCurtain).toHaveBeenCalledTimes(1);

    runtime.destroy();
    expect(lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(window.__lenis).toBeUndefined();
    expect('__lenis' in window).toBe(false);
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    expect(unmountMagnetic).toHaveBeenCalledTimes(1);
    expect(curtainHandle.destroy).toHaveBeenCalledTimes(1);
  });

  it('navigating to a flow page destroys Lenis; coming back creates a fresh one', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    runtime.sync(state({ segment: 'cart', pathname: '/cart' }));
    await settle();
    expect(lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(window.__lenis).toBeUndefined();
    expect(unmountMagnetic).toHaveBeenCalledTimes(1);

    runtime.sync(state({ segment: 'about', pathname: '/about' }));
    await settle();
    expect(createLenis).toHaveBeenCalledTimes(2);
    expect(window.__lenis).toBe(lenisInstances[1]);
    runtime.destroy();
  });

  it('brand to brand navigation resets the scroll position and tells the curtain', async () => {
    const runtime = await loadRuntime();
    const options = { smooth: true, magnetic: false, curtain: true, progress: false, cursor: false };
    runtime.sync(state({ options }));
    await settle();
    runtime.sync(state({ options, segment: 'about', pathname: '/about' }));
    expect(lenisInstances[0].scrollTo).toHaveBeenCalledWith(0, { immediate: true, force: true });
    expect(curtainHandle.arrived).toHaveBeenCalledTimes(1);
    expect(createLenis).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it('a Lenis chunk that arrives after leaving the brand page is discarded', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    runtime.sync(state({ segment: 'cart', pathname: '/cart' }));
    await settle();
    expect(lenisInstances).toHaveLength(1);
    expect(lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(window.__lenis).toBeUndefined();
    expect(document.documentElement.style.scrollBehavior).toBe('');
    runtime.destroy();
  });

  it('stops Lenis while the page is scroll-locked and restarts it after', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: false, curtain: false, progress: false, cursor: false } }));
    await settle();
    const lenis = lenisInstances[0];

    document.body.style.overflow = 'hidden';
    await settle();
    expect(lenis.stop).toHaveBeenCalledTimes(1);

    document.body.style.overflow = '';
    await settle();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(lenis.resize).toHaveBeenCalled();
    expect(lenis.start).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  // ── Scroll progress bar and cursor dot ────────────────────────────────

  it('options off (the default): no progress bar, no cursor dot', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    expect(mountProgress).not.toHaveBeenCalled();
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('brand page: progress bar and cursor dot mount once on the store root and unmount on destroy', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    runtime.sync(state({ options: everything }));
    await settle();
    runtime.sync(state({ options: everything }));
    await settle();
    expect(mountProgress).toHaveBeenCalledTimes(1);
    expect(mountProgress).toHaveBeenCalledWith(document.querySelector('.store-root'));
    expect(mountCursor).toHaveBeenCalledTimes(1);
    expect(mountCursor).toHaveBeenCalledWith(document.querySelector('.store-root'));
    runtime.destroy();
    expect(unmountProgress).toHaveBeenCalledTimes(1);
    expect(unmountCursor).toHaveBeenCalledTimes(1);
  });

  it.each(['products', 'collections'])('shop segment %s: the progress bar stays, the cursor dot does not', async (segment) => {
    const runtime = await loadRuntime();
    runtime.sync(state({ segment, pathname: `/${segment}`, options: everything }));
    await settle();
    expect(mountProgress).toHaveBeenCalledTimes(1);
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it.each(['cart', '(checkout)', 'account', 'auth', 'legal'])('flow segment %s: neither', async (segment) => {
    const runtime = await loadRuntime();
    runtime.sync(state({ segment, pathname: `/${segment}`, options: everything }));
    await settle();
    expect(mountProgress).not.toHaveBeenCalled();
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('leaving for a flow page removes both; coming back mounts them again', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    await settle();
    runtime.sync(state({ options: everything, segment: 'cart', pathname: '/cart' }));
    await settle();
    expect(unmountProgress).toHaveBeenCalledTimes(1);
    expect(unmountCursor).toHaveBeenCalledTimes(1);
    runtime.sync(state({ options: everything, segment: 'about', pathname: '/about' }));
    await settle();
    expect(mountProgress).toHaveBeenCalledTimes(2);
    expect(mountCursor).toHaveBeenCalledTimes(2);
    runtime.destroy();
  });

  it('a chunk that arrives after the page was left mounts nothing', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    runtime.sync(state({ options: everything, segment: 'cart', pathname: '/cart' }));
    await settle();
    expect(mountProgress).not.toHaveBeenCalled();
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
    expect(unmountProgress).not.toHaveBeenCalled();
  });

  it('touch device: the progress bar (passive) stays, the cursor dot does not', async () => {
    env.fine = false;
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    await settle();
    expect(mountProgress).toHaveBeenCalledTimes(1);
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('calm profile: the progress bar only mirrors the scroll and stays, the cursor dot does not', async () => {
    mountRoot({ 'data-motion-reveal': 'calm' });
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    await settle();
    expect(mountProgress).toHaveBeenCalledTimes(1);
    expect(mountCursor).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it.each([
    ['store motion off', { 'data-motion-reveal': 'off' }, true],
    ['builder preview', { 'data-cx-builder': '' }, true],
    ['reduced motion (no gate attribute)', {}, false],
  ])('%s: no progress bar, no cursor dot, no curtain', async (_name, attrs, flagged) => {
    mountRoot(attrs as Record<string, string>);
    if (!flagged) document.documentElement.removeAttribute('data-cx-motion');
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    await settle();
    expect(mountProgress).not.toHaveBeenCalled();
    expect(mountCursor).not.toHaveBeenCalled();
    expect(mountCurtain).not.toHaveBeenCalled();
    expect(startScan).not.toHaveBeenCalled();
    runtime.destroy();
  });

  // ── Reduced motion switched on while the page is open ─────────────────

  it('reduced motion switched on mid-session tears everything down', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state({ options: everything }));
    await settle();
    expect(reduceListeners.size).toBe(1);
    expect(window.__lenis).toBe(lenisInstances[0]);

    env.reduce = true;
    for (const cb of Array.from(reduceListeners)) cb();
    expect(document.documentElement.hasAttribute('data-cx-motion')).toBe(false);
    expect(lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(window.__lenis).toBeUndefined();
    expect(stopScan).toHaveBeenCalledTimes(1);
    expect(unmountMagnetic).toHaveBeenCalledTimes(1);
    expect(curtainHandle.destroy).toHaveBeenCalledTimes(1);
    expect(unmountProgress).toHaveBeenCalledTimes(1);
    expect(unmountCursor).toHaveBeenCalledTimes(1);

    // Nothing comes back on the next route.
    runtime.sync(state({ options: everything, segment: 'about', pathname: '/about' }));
    await settle();
    expect(createLenis).toHaveBeenCalledTimes(1);
    expect(mountProgress).toHaveBeenCalledTimes(1);
    runtime.destroy();
    expect(reduceListeners.size).toBe(0);
  });

  // ── Smooth scrolling: anchors, fragments, locks ───────────────────────

  function anchorFixture() {
    const root = document.querySelector('.store-root') as HTMLElement;
    root.style.setProperty('--cx-header-h', '72px');
    root.innerHTML =
      '<a id="go" href="#story"><span>Story</span></a><a id="away" href="/about#team">Team</a>' +
      '<a id="tab" href="#story" target="_blank">New tab</a><a id="missing" href="#nowhere">Nowhere</a>' +
      '<section id="story"><button id="inside">Inside</button></section>';
    const el = (id: string) => root.querySelector(`#${id}`) as HTMLElement;
    return { root, el };
  }

  function click(el: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1, ...init });
    (el.querySelector('span') || el).dispatchEvent(event);
    return event;
  }

  it('a same-page anchor glides to its target below the sticky header and keeps the pointer focus', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    const { el } = anchorFixture();
    el('go').focus();

    const event = click(el('go'));
    expect(event.defaultPrevented).toBe(true);
    expect(lenis.scrollTo).toHaveBeenCalledWith(el('story'), { offset: -72, force: true });
    expect(window.location.hash).toBe('#story');
    // A pointer click moves no focus and leaves the target untouched.
    expect(document.activeElement).toBe(el('go'));
    expect(el('story').hasAttribute('tabindex')).toBe(false);
    runtime.destroy();
  });

  it('keyboard activation moves on to the target, as fragment navigation does', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const { el } = anchorFixture();
    click(el('go'), { detail: 0 });
    expect(document.activeElement).toBe(el('story'));
    // The helper attribute leaves with the focus.
    el('inside').focus();
    expect(el('story').hasAttribute('tabindex')).toBe(false);
    runtime.destroy();
  });

  it('leaves other links alone: other pages, new tabs, modified clicks, missing targets', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    const { el } = anchorFixture();
    // jsdom does not navigate: swallow after the runtime saw the click.
    const swallow = (e: Event) => e.preventDefault();
    document.addEventListener('click', swallow);
    click(el('away'));
    click(el('tab'));
    click(el('missing'));
    click(el('go'), { ctrlKey: true });
    click(el('go'), { metaKey: true });
    click(el('go'), { shiftKey: true });
    click(el('go'), { button: 1 });
    document.removeEventListener('click', swallow);
    expect(lenis.scrollTo).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    runtime.destroy();
  });

  it('an anchor clicked inside an open drawer glides only after the page is unlocked', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    const { el } = anchorFixture();

    document.body.style.overflow = 'hidden';
    await settle();
    expect(lenis.stop).toHaveBeenCalledTimes(1);
    expect(click(el('go')).defaultPrevented).toBe(true);
    expect(lenis.scrollTo).not.toHaveBeenCalled();

    document.body.style.overflow = '';
    await settle();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // First the position the lock left behind, then the glide.
    expect(lenis.scrollTo.mock.calls).toEqual([
      [window.scrollY, { immediate: true, force: true }],
      [el('story'), { offset: -72, force: true }],
    ]);
    expect(lenis.start).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it('a fragment change from the address bar or history follows the browser position', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    window.dispatchEvent(new Event('hashchange'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(lenis.scrollTo).toHaveBeenCalledWith(window.scrollY, { immediate: true, force: true });
    runtime.destroy();
  });

  it('back / forward keeps the restored position instead of jumping to the top', async () => {
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    window.dispatchEvent(new Event('popstate'));
    runtime.sync(state({ segment: 'about', pathname: '/about' }));
    expect(lenis.scrollTo).not.toHaveBeenCalledWith(0, { immediate: true, force: true });
    runtime.destroy();
  });

  it('destroy removes the anchor, fragment, history and reduced-motion listeners', async () => {
    const docRemoved = vi.spyOn(document, 'removeEventListener');
    const winRemoved = vi.spyOn(window, 'removeEventListener');
    const runtime = await loadRuntime();
    runtime.sync(state());
    await settle();
    const lenis = lenisInstances[0];
    const { el } = anchorFixture();
    runtime.destroy();
    expect(docRemoved).toHaveBeenCalledWith('click', expect.any(Function), true);
    expect(winRemoved).toHaveBeenCalledWith('hashchange', expect.any(Function));
    expect(winRemoved).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(winRemoved).toHaveBeenCalledWith('cx:gsap', expect.any(Function));
    expect(reduceListeners.size).toBe(0);
    // The anchor is a plain link again.
    const swallow = (e: Event) => e.preventDefault();
    document.addEventListener('click', swallow);
    click(el('go'));
    document.removeEventListener('click', swallow);
    expect(lenis.scrollTo).not.toHaveBeenCalled();
    docRemoved.mockRestore();
    winRemoved.mockRestore();
  });

  // ── One loop, one clock ───────────────────────────────────────────────

  it('drives Lenis from its own frame loop on the page clock until GSAP arrives', async () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => callbacks.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const now = vi.spyOn(performance, 'now').mockReturnValue(41000);
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: false, curtain: false, progress: false, cursor: false } }));
    await settle();
    const lenis = lenisInstances[0];
    expect(callbacks).toHaveLength(1);
    callbacks[0]();
    expect(lenis.raf).toHaveBeenLastCalledWith(41000);
    expect(ticker.add).not.toHaveBeenCalled();
    runtime.destroy();
    now.mockRestore();
    vi.unstubAllGlobals();
    stubMedia();
  });

  it('moves onto the GSAP ticker when GSAP arrives and keeps the page clock (a glide in flight never freezes)', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(41000);
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: false, curtain: false, progress: false, cursor: false } }));
    await settle();
    const lenis = lenisInstances[0];

    gsapLoaded = true;
    window.dispatchEvent(new Event('cx:gsap'));
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(ticker.lagSmoothing).toHaveBeenLastCalledWith(0);
    const tick = ticker.add.mock.calls[0][0] as (time: number) => void;
    // GSAP hands its own clock (seconds since it started): it must not reach Lenis.
    now.mockReturnValue(41016);
    tick(0.016);
    expect(lenis.raf).toHaveBeenLastCalledWith(41016);
    // ScrollTrigger reads the position Lenis just wrote.
    const onScroll = lenis.on.mock.calls.find((c) => c[0] === 'scroll')?.[1] as () => void;
    onScroll();
    expect(scrollTriggerUpdate).toHaveBeenCalledTimes(1);

    runtime.destroy();
    expect(ticker.remove).toHaveBeenCalledWith(tick);
    expect(lenis.off).toHaveBeenCalledWith('scroll', onScroll);
    expect(ticker.lagSmoothing).toHaveBeenLastCalledWith(500, 33);
    now.mockRestore();
  });
});
