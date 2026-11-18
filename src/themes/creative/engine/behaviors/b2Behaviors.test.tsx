import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BehaviorContext } from '../core';
import type { GsapBundle } from '../gsap';
import steps from './steps';
import track from './track';

interface FakeTween {
  target: unknown;
  vars: Record<string, unknown> & { scrollTrigger: Record<string, unknown>; onUpdate: () => void };
  value: number;
  progress: () => number;
  kill: ReturnType<typeof vi.fn>;
  scrollTrigger: { kill: ReturnType<typeof vi.fn>; start: number; end: number };
}

function fakeGsap() {
  const tweens: FakeTween[] = [];
  const gsap = {
    to: vi.fn((target: unknown, vars: FakeTween['vars']) => {
      const tween: FakeTween = {
        target,
        vars,
        value: 0,
        progress: () => tween.value,
        kill: vi.fn(),
        scrollTrigger: { kill: vi.fn(), start: 1000, end: 2000 },
      };
      tweens.push(tween);
      return tween;
    }),
    set: vi.fn(),
  };
  return { gsap, tweens, bundle: { gsap, ScrollTrigger: {} } as unknown as GsapBundle };
}

function context(scope: HTMLElement, bundle: GsapBundle, rtl = false) {
  const resize: Array<() => void> = [];
  const stopResize = vi.fn();
  const loadGsap = vi.fn(() => Promise.resolve(bundle));
  const ctx: BehaviorContext = {
    scope,
    rtl,
    calm: false,
    loadGsap,
    headerHeight: () => 64,
    onResize: (cb) => {
      resize.push(cb);
      return stopResize;
    },
  };
  return { ctx, loadGsap, resize, stopResize };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function media(fine: boolean) {
  window.matchMedia = ((query: string) => ({ matches: fine, media: query })) as unknown as typeof window.matchMedia;
}

/** Makes getComputedStyle report the given position for the stage. */
function position(stage: HTMLElement, value: { current: string }) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const cs = real(el, pseudo);
    if (el !== stage) return cs;
    return new Proxy(cs, { get: (t, k) => (k === 'position' ? value.current : Reflect.get(t, k)) });
  });
}

function trackDom() {
  document.body.innerHTML = `
    <section data-cx-section="story-pinned">
      <span data-cx-current="">01</span>
      <div class="cx-track"><div class="cx-track-stage"><div class="cx-track-view">
        <ol class="cx-track-row">
          <li data-cx-card-item=""></li><li data-cx-card-item=""></li><li data-cx-card-item=""></li>
        </ol>
      </div></div></div>
    </section>`;
  const scope = document.querySelector('section') as HTMLElement;
  const el = scope.querySelector('.cx-track') as HTMLElement;
  const stage = scope.querySelector('.cx-track-stage') as HTMLElement;
  const view = scope.querySelector('.cx-track-view') as HTMLElement;
  const row = scope.querySelector('.cx-track-row') as HTMLElement;
  Object.defineProperty(row, 'scrollWidth', { value: 2600, configurable: true });
  Object.defineProperty(view, 'clientWidth', { value: 1400, configurable: true });
  return { scope, el, stage, view, row };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('track behaviour', () => {
  it('does nothing when the stage is not sticky (touch): no GSAP, no live marker', async () => {
    const d = trackDom();
    position(d.stage, { current: 'static' });
    media(false);
    const g = fakeGsap();
    const c = context(d.scope, g.bundle);
    const cleanup = await track(d.el, c.ctx);
    await flush();
    expect(cleanup).toBeUndefined();
    expect(c.loadGsap).not.toHaveBeenCalled();
    expect(d.el.hasAttribute('data-cx-live')).toBe(false);
  });

  it('on a narrow desktop window it waits: GSAP is loaded only once the stage is sticky', async () => {
    const d = trackDom();
    const pos = { current: 'static' };
    position(d.stage, pos);
    media(true);
    const g = fakeGsap();
    const c = context(d.scope, g.bundle);
    const cleanup = (await track(d.el, c.ctx)) as () => void;
    await flush();
    expect(c.loadGsap).not.toHaveBeenCalled();
    expect(d.el.hasAttribute('data-cx-live')).toBe(false);
    // The window grows past the breakpoint.
    pos.current = 'sticky';
    c.resize[0]();
    await flush();
    expect(c.loadGsap).toHaveBeenCalledTimes(1);
    expect(g.tweens.length).toBe(1);
    expect(d.el.hasAttribute('data-cx-live')).toBe(true);
    // And shrinks again: back to the native row.
    pos.current = 'static';
    c.resize[0]();
    expect(g.tweens[0].scrollTrigger.kill).toHaveBeenCalled();
    expect(d.el.hasAttribute('data-cx-live')).toBe(false);
    cleanup();
  });

  it('moves the row by its overflow, to the left in LTR, and cleans up', async () => {
    const d = trackDom();
    position(d.stage, { current: 'sticky' });
    media(true);
    const g = fakeGsap();
    const c = context(d.scope, g.bundle);
    const cleanup = (await track(d.el, c.ctx)) as () => void;
    await flush();
    const tween = g.tweens[0];
    expect(tween.target).toBe(d.row);
    expect((tween.vars.x as () => number)()).toBe(-1200);
    const st = tween.vars.scrollTrigger;
    expect(st.trigger).toBe(d.el);
    expect((st.start as () => string)()).toBe('clamp(top 64px)');
    expect(st.end).toBe('clamp(bottom bottom)');
    expect(st.invalidateOnRefresh).toBe(true);
    // Pinning is CSS sticky, never ScrollTrigger pin.
    expect(st.pin).toBeUndefined();
    // The live marker comes after the tween exists.
    expect(d.el.hasAttribute('data-cx-live')).toBe(true);
    // Progress and counter follow the tween.
    tween.value = 1;
    tween.vars.onUpdate();
    expect(d.el.style.getPropertyValue('--cx-p')).toBe('1.0000');
    expect(d.scope.querySelector('[data-cx-current]')?.textContent).toBe('03');

    cleanup();
    expect(tween.scrollTrigger.kill).toHaveBeenCalled();
    expect(tween.kill).toHaveBeenCalled();
    expect(c.stopResize).toHaveBeenCalled();
    expect(d.el.hasAttribute('data-cx-live')).toBe(false);
    expect(d.el.style.getPropertyValue('--cx-p')).toBe('');
    expect(d.scope.querySelector('[data-cx-current]')?.textContent).toBe('01');
  });

  it('flips the direction in RTL', async () => {
    const d = trackDom();
    position(d.stage, { current: 'sticky' });
    media(true);
    const g = fakeGsap();
    const c = context(d.scope, g.bundle, true);
    const cleanup = (await track(d.el, c.ctx)) as () => void;
    await flush();
    expect((g.tweens[0].vars.x as () => number)()).toBe(1200);
    cleanup();
  });

  it('a cleanup before GSAP arrives builds nothing', async () => {
    const d = trackDom();
    position(d.stage, { current: 'sticky' });
    media(true);
    const g = fakeGsap();
    const c = context(d.scope, g.bundle);
    // The behaviour returns its cleanup synchronously; GSAP resolves later.
    const cleanup = track(d.el, c.ctx) as () => void;
    cleanup();
    await flush();
    expect(c.loadGsap).toHaveBeenCalledTimes(1);
    expect(g.tweens.length).toBe(0);
    expect(d.el.hasAttribute('data-cx-live')).toBe(false);
  });
});

describe('steps behaviour', () => {
  function stepsDom() {
    document.body.innerHTML = `
      <section data-cx-section="sticky-steps"><ol class="cx-st-list" data-cx-line="">
        <li class="cx-st-step"><span class="cx-st-dot"></span></li>
        <li class="cx-st-step"><span class="cx-st-dot"></span></li>
        <li class="cx-st-step"><span class="cx-st-dot"></span></li>
      </ol></section>`;
    const scope = document.querySelector('section') as HTMLElement;
    const list = scope.querySelector('ol') as HTMLElement;
    const items = Array.from(list.querySelectorAll<HTMLElement>('li'));
    Object.defineProperty(list, 'offsetHeight', { value: 300, configurable: true });
    items.forEach((item, i) => Object.defineProperty(item, 'offsetTop', { value: 10 + i * 100, configurable: true }));
    return { scope, list, items };
  }

  it('marks the list live, ties line and steps to the progress, and restores the static state', async () => {
    const d = stepsDom();
    const g = fakeGsap();
    const c = context(d.scope, g.bundle);
    const cleanup = (await steps(d.list, c.ctx)) as () => void;
    expect(d.list.hasAttribute('data-cx-live')).toBe(true);
    expect(d.list.style.getPropertyValue('--cx-p')).toBe('0.0000');
    expect(d.list.querySelectorAll('[data-cx-passed]').length).toBe(0);

    const tween = g.tweens[0];
    const st = tween.vars.scrollTrigger;
    expect(st.trigger).toBe(d.list);
    expect(st.start).toBe('clamp(top 60%)');
    expect(st.end).toBe('clamp(bottom 60%)');
    expect(st.scrub).toBe(0.6);

    const state = tween.target as { p: number };
    state.p = 0.5;
    tween.vars.onUpdate();
    expect(d.list.style.getPropertyValue('--cx-p')).toBe('0.5000');
    expect(d.items.map((i) => i.hasAttribute('data-cx-passed'))).toEqual([true, true, false]);
    // Reversible.
    state.p = 0.1;
    tween.vars.onUpdate();
    expect(d.items.map((i) => i.hasAttribute('data-cx-passed'))).toEqual([true, false, false]);
    state.p = 1;
    tween.vars.onUpdate();
    expect(d.items.every((i) => i.hasAttribute('data-cx-passed'))).toBe(true);

    cleanup();
    expect(tween.scrollTrigger.kill).toHaveBeenCalled();
    expect(tween.kill).toHaveBeenCalled();
    expect(d.list.hasAttribute('data-cx-live')).toBe(false);
    expect(d.list.style.getPropertyValue('--cx-p')).toBe('');
    expect(d.list.querySelectorAll('[data-cx-passed]').length).toBe(0);
  });

  it('does not load GSAP for an empty list', async () => {
    document.body.innerHTML = '<section><ol class="cx-st-list"></ol></section>';
    const g = fakeGsap();
    const scope = document.querySelector('section') as HTMLElement;
    const c = context(scope, g.bundle);
    expect(await steps(scope.querySelector('ol') as HTMLElement, c.ctx)).toBeUndefined();
    expect(c.loadGsap).not.toHaveBeenCalled();
  });
});
