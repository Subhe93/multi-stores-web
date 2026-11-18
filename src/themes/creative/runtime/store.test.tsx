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

// ── Environment ─────────────────────────────────────────────────────────

const env = { reduce: false, fine: true, desktop: true };
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
      addEventListener: () => {},
      removeEventListener: () => {},
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
  options: { smooth: true, magnetic: true, curtain: false },
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
      runtime.sync(state({ segment, pathname: `/${segment}`, options: { smooth: true, magnetic: true, curtain: true } }));
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
      runtime.sync(state({ segment, pathname: `/${segment}`, options: { smooth: true, magnetic: true, curtain: true } }));
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
    runtime.sync(state({ options: { smooth: true, magnetic: true, curtain: true } }));
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
    runtime.sync(state({ options: { smooth: false, magnetic: false, curtain: false } }));
    await settle();
    expect(createLenis).not.toHaveBeenCalled();
    expect(mountMagnetic).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('destroy restores scroll-behavior, deletes window.__lenis and unmounts everything', async () => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const runtime = await loadRuntime();
    runtime.sync(state({ options: { smooth: true, magnetic: true, curtain: true } }));
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
    const options = { smooth: true, magnetic: false, curtain: true };
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
    runtime.sync(state({ options: { smooth: true, magnetic: false, curtain: false } }));
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
});
