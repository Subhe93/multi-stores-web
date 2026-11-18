import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BehaviorContext } from '../core';

class FakeIO {
  static all: FakeIO[] = [];
  els = new Set<Element>();
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
  }
  fire(el: Element) {
    this.cb([{ target: el, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
const observers = (el: Element) => FakeIO.all.filter((io) => io.els.has(el));

function host(mode: string | null, top: number) {
  const el = document.createElement('div');
  if (mode) el.setAttribute('data-cx-draw', mode);
  el.getBoundingClientRect = () => ({ top, bottom: top + 48 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function fakeGsap() {
  const trigger = { kill: vi.fn() };
  const tween = { scrollTrigger: trigger, kill: vi.fn() };
  const fromTo = vi.fn(() => tween);
  return { bundle: { gsap: { fromTo }, ScrollTrigger: {} }, fromTo, tween, trigger };
}

function context(scope: HTMLElement, gsap = fakeGsap()) {
  const loadGsap = vi.fn(async () => gsap.bundle);
  const ctx = { scope, rtl: false, calm: false, loadGsap, onResize: () => () => {}, headerHeight: () => 0 };
  return { ctx: ctx as unknown as BehaviorContext, loadGsap, gsap };
}

async function loadDraw() {
  vi.resetModules();
  return (await import('./draw')).default;
}

describe('draw behaviour', () => {
  beforeEach(() => {
    FakeIO.all = [];
    vi.stubGlobal('IntersectionObserver', FakeIO);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 6000, configurable: true });
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('once: arms a host below the viewport, draws on entry, cleans up completely, no GSAP', async () => {
    const draw = await loadDraw();
    const el = host('once', 2400);
    const { ctx, loadGsap } = context(el);
    const cleanup = await draw(el, ctx);
    expect(el.hasAttribute('data-cx-armed')).toBe(true);
    expect(el.hasAttribute('data-cx-drawn')).toBe(false);
    expect(observers(el)).toHaveLength(1);
    expect(observers(el)[0].options?.rootMargin).toBe('0px 0px -12% 0px');

    observers(el)[0].fire(el);
    expect(el.hasAttribute('data-cx-drawn')).toBe(true);
    expect(loadGsap).not.toHaveBeenCalled();

    expect(typeof cleanup).toBe('function');
    (cleanup as () => void)();
    expect(el.hasAttribute('data-cx-armed')).toBe(false);
    expect(el.hasAttribute('data-cx-drawn')).toBe(false);
    expect(observers(el)).toHaveLength(0);
  });

  it('once: cleanup before entry stops observing', async () => {
    const draw = await loadDraw();
    const el = host('once', 2400);
    const cleanup = await draw(el, context(el).ctx);
    (cleanup as () => void)();
    expect(observers(el)).toHaveLength(0);
    expect(el.hasAttribute('data-cx-armed')).toBe(false);
  });

  it('once: a host near the end of the page is observed without a margin', async () => {
    const draw = await loadDraw();
    // Max scroll 5200; at the end the host top sits at 5950 - 5200 = 750 px (> 88 % of 800).
    const el = host('once', 5950);
    await draw(el, context(el).ctx);
    expect(observers(el)[0].options?.rootMargin).toBe('0px');
  });

  it('never hides what is on screen or already passed', async () => {
    const draw = await loadDraw();
    for (const mode of ['once', 'scroll']) {
      for (const top of [-300, 120, 799]) {
        const el = host(mode, top);
        const { ctx, loadGsap } = context(el);
        expect(await draw(el, ctx)).toBeUndefined();
        expect(el.hasAttribute('data-cx-armed')).toBe(false);
        expect(el.hasAttribute('data-cx-live')).toBe(false);
        expect(loadGsap).not.toHaveBeenCalled();
        expect(observers(el)).toHaveLength(0);
      }
    }
  });

  it('does nothing for an unknown or missing mode', async () => {
    const draw = await loadDraw();
    for (const mode of [null, 'none', 'fast']) {
      const el = host(mode, 2400);
      const { ctx, loadGsap } = context(el);
      expect(await draw(el, ctx)).toBeUndefined();
      expect(el.attributes).toHaveLength(mode ? 1 : 0);
      expect(loadGsap).not.toHaveBeenCalled();
    }
  });

  it('scroll: one clamped scrub trigger writes --cx-p; live only after it is built; cleanup kills it', async () => {
    const draw = await loadDraw();
    const el = host('scroll', 2400);
    const gsap = fakeGsap();
    gsap.fromTo.mockImplementation(() => {
      // The stroke rule must not switch before the tween exists.
      expect(el.hasAttribute('data-cx-live')).toBe(false);
      return gsap.tween;
    });
    const { ctx, loadGsap } = context(el, gsap);
    const cleanup = await draw(el, ctx);
    expect(loadGsap).toHaveBeenCalledTimes(1);
    expect(gsap.fromTo).toHaveBeenCalledTimes(1);
    const [target, from, to] = gsap.fromTo.mock.calls[0] as unknown as [
      HTMLElement,
      Record<string, unknown>,
      Record<string, unknown> & { scrollTrigger: Record<string, unknown> },
    ];
    expect(target).toBe(el);
    expect(from['--cx-p']).toBe(0);
    expect(to['--cx-p']).toBe(1);
    expect(to.ease).toBe('none');
    expect(to.scrollTrigger).toMatchObject({
      trigger: el,
      start: 'clamp(top 85%)',
      end: 'clamp(top 45%)',
      invalidateOnRefresh: true,
    });
    expect(to.scrollTrigger.scrub).toBeTruthy();
    expect(to.scrollTrigger.pin).toBeUndefined();
    expect(el.hasAttribute('data-cx-live')).toBe(true);
    expect(observers(el)).toHaveLength(0);

    (cleanup as () => void)();
    expect(gsap.trigger.kill).toHaveBeenCalledTimes(1);
    expect(gsap.tween.kill).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute('data-cx-live')).toBe(false);
    expect(el.style.getPropertyValue('--cx-p')).toBe('');
  });
});
