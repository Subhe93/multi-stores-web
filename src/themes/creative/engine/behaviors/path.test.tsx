import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BehaviorContext } from '../core';
import type { GsapBundle } from '../gsap';
import path from './path';

// The behaviour against a fake GSAP: what it builds, when it goes live and
// what its cleanup leaves behind. Real scrolling is checked in a browser.

interface FakeTween {
  target: { p: number };
  vars: Record<string, unknown>;
  scrollTrigger: { progress: number; kill: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
  progress: ReturnType<typeof vi.fn>;
}

function fakeGsap(progress = 0) {
  const tweens: FakeTween[] = [];
  const setters: Array<{ el: Element; prop: string; values: number[] }> = [];
  const cleared: Element[] = [];
  const gsap = {
    quickSetter(el: Element, prop: string) {
      const record = { el, prop, values: [] as number[] };
      setters.push(record);
      return (value: number) => record.values.push(value);
    },
    to(target: { p: number }, vars: Record<string, unknown>) {
      const tween: FakeTween = {
        target,
        vars,
        scrollTrigger: { progress, kill: vi.fn() },
        kill: vi.fn(),
        progress: vi.fn(),
      };
      tweens.push(tween);
      return tween;
    },
    set(el: Element) {
      cleared.push(el);
    },
  };
  return { bundle: { gsap, ScrollTrigger: {} } as unknown as GsapBundle, tweens, setters, cleared };
}

function build(stops = 3, options: { rotate?: boolean } = {}) {
  const host = document.createElement('div');
  host.className = 'cx-mp-body';
  if (options.rotate) host.setAttribute('data-cx-rotate', '');
  const items = Array.from({ length: stops }, () => '<li class="cx-mp-stop"><div class="cx-mp-dot"></div></li>');
  host.innerHTML = `
    <div class="cx-mp-rail">
      <div class="cx-mp-layer cx-mp-base"><svg viewBox="0 0 100 200"><path class="cx-mp-p cx-mp-p-line" d="M50 0V200"/></svg></div>
      <div class="cx-mp-layer cx-mp-trail"></div>
      <div class="cx-mp-art"><div class="cx-mp-art-in"></div></div>
    </div>
    <ol class="cx-mp-stops">${items.join('')}</ol>`;
  document.body.appendChild(host);
  const rail = host.querySelector<HTMLElement>('.cx-mp-rail')!;
  Object.defineProperty(rail, 'clientWidth', { value: 100, configurable: true });
  Object.defineProperty(rail, 'clientHeight', { value: 400, configurable: true });
  rail.getBoundingClientRect = () => ({ top: 100, left: 0, width: 100, height: 400, bottom: 500, right: 100 }) as DOMRect;
  // Markers at 0, 200 and 400 px down the line.
  host.querySelectorAll<HTMLElement>('.cx-mp-dot').forEach((dot, i) => {
    const top = 100 + i * 200 - 6;
    dot.getBoundingClientRect = () => ({ top, height: 12, left: 44, width: 12, bottom: top + 12, right: 56 }) as DOMRect;
  });
  return host;
}

function context(host: HTMLElement, bundle: GsapBundle, extra: Partial<BehaviorContext> = {}) {
  const resize: Array<() => void> = [];
  const stopResize = vi.fn();
  const ctx: BehaviorContext = {
    scope: host,
    rtl: false,
    calm: false,
    loadGsap: () => Promise.resolve(bundle),
    onResize(cb) {
      resize.push(cb);
      return stopResize;
    },
    headerHeight: () => 0,
    ...extra,
  };
  return { ctx, resize, stopResize };
}

const passed = (host: HTMLElement) =>
  Array.from(host.querySelectorAll('.cx-mp-stop')).map((stop) => stop.hasAttribute('data-cx-passed'));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('path behaviour', () => {
  it('does nothing without a line or with a single stop (GSAP is not even loaded)', async () => {
    const g = fakeGsap();
    const loadGsap = vi.fn(() => Promise.resolve(g.bundle));

    const one = build(1);
    expect(await path(one, { ...context(one, g.bundle).ctx, loadGsap })).toBeUndefined();

    const noRail = build(3);
    noRail.querySelector('.cx-mp-rail')!.remove();
    expect(await path(noRail, { ...context(noRail, g.bundle).ctx, loadGsap })).toBeUndefined();

    expect(loadGsap).not.toHaveBeenCalled();
    expect(g.tweens).toHaveLength(0);
    expect(one.hasAttribute('data-cx-live')).toBe(false);
    expect(noRail.hasAttribute('data-cx-live')).toBe(false);
  });

  it('builds one scrubbed trigger on the line with clamped starts', async () => {
    const host = build();
    const g = fakeGsap();
    await path(host, context(host, g.bundle).ctx);
    expect(g.tweens).toHaveLength(1);
    const st = g.tweens[0].vars.scrollTrigger as Record<string, unknown>;
    expect(st.trigger).toBe(host.querySelector('.cx-mp-rail'));
    expect(st.start).toBe('clamp(top 70%)');
    expect(st.end).toBe('clamp(bottom 60%)');
    expect(st.scrub).toBe(0.8);
    expect(st.invalidateOnRefresh).toBe(true);
    expect(g.tweens[0].vars.ease).toBe('none');
  });

  it('goes live only after the first state is written, from the current scroll progress', async () => {
    const host = build();
    const g = fakeGsap(0.5);
    const seen: boolean[] = [];
    const trail = host.querySelector<HTMLElement>('.cx-mp-trail')!;
    const setProperty = trail.style.setProperty.bind(trail.style);
    trail.style.setProperty = (...args: Parameters<CSSStyleDeclaration['setProperty']>) => {
      seen.push(host.hasAttribute('data-cx-live'));
      setProperty(...args);
    };
    await path(host, context(host, g.bundle).ctx);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((live) => live === false)).toBe(true);
    expect(host.hasAttribute('data-cx-live')).toBe(true);
    // Half way down a 400 px line: 200 px of trail still clipped, two stops passed.
    expect(trail.style.getPropertyValue('--cx-mp-clip')).toBe('200.0px');
    expect(passed(host)).toEqual([true, true, false]);
    // The artwork is parked at the bottom centre in CSS: half way is 200 px up, on the centre line.
    expect(g.setters.find((s) => s.prop === 'y')!.values.at(-1)).toBe(-200);
    expect(g.setters.find((s) => s.prop === 'x')!.values.at(-1)).toBe(0);
  });

  it('is reversible: scrolling back un-passes the stops and clips the trail again', async () => {
    const host = build();
    const g = fakeGsap(1);
    await path(host, context(host, g.bundle).ctx);
    expect(passed(host)).toEqual([true, true, true]);
    // The scrubbed tween moves its target back and reports the update.
    const tween = g.tweens[0];
    tween.target.p = 0.25;
    (tween.vars.onUpdate as () => void)();
    expect(passed(host)).toEqual([true, false, false]);
    expect(host.querySelector<HTMLElement>('.cx-mp-trail')!.style.getPropertyValue('--cx-mp-clip')).toBe('300.0px');
  });

  it('turns the artwork only when asked, and never under the calm profile', async () => {
    const plain = build();
    const a = fakeGsap();
    await path(plain, context(plain, a.bundle).ctx);
    expect(a.setters.some((s) => s.prop === 'rotation')).toBe(false);

    const turning = build(3, { rotate: true });
    const b = fakeGsap();
    await path(turning, context(turning, b.bundle).ctx);
    expect(b.setters.some((s) => s.prop === 'rotation' && s.el.classList.contains('cx-mp-art-in'))).toBe(true);

    const calm = build(3, { rotate: true });
    const c = fakeGsap();
    await path(calm, context(calm, c.bundle, { calm: true }).ctx);
    expect(c.setters.some((s) => s.prop === 'rotation')).toBe(false);
  });

  it('re-measures on resize and on refresh', async () => {
    const host = build();
    const g = fakeGsap(1);
    const { ctx, resize } = context(host, g.bundle);
    await path(host, ctx);
    expect(resize).toHaveLength(1);
    const rail = host.querySelector<HTMLElement>('.cx-mp-rail')!;
    Object.defineProperty(rail, 'clientWidth', { value: 300, configurable: true });
    const y = g.setters.find((s) => s.prop === 'y')!;
    const count = y.values.length;
    resize[0]();
    expect(y.values.length).toBe(count + 1);
    (g.tweens[0].vars.scrollTrigger as { onRefresh: () => void }).onRefresh();
    expect(y.values.length).toBe(count + 2);
  });

  it('cleanup kills its trigger and leaves the static section', async () => {
    const host = build(3, { rotate: true });
    const g = fakeGsap(0.5);
    const { ctx, stopResize } = context(host, g.bundle);
    const cleanup = (await path(host, ctx)) as () => void;
    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(g.tweens[0].scrollTrigger.kill).toHaveBeenCalledTimes(1);
    expect(g.tweens[0].kill).toHaveBeenCalledTimes(1);
    expect(stopResize).toHaveBeenCalledTimes(1);
    expect(host.hasAttribute('data-cx-live')).toBe(false);
    expect(host.querySelector('[data-cx-passed]')).toBeNull();
    expect(host.querySelector<HTMLElement>('.cx-mp-trail')!.style.getPropertyValue('--cx-mp-clip')).toBe('');
    // Transforms of the artwork and its inner wrapper are cleared.
    expect(g.cleared).toEqual([host.querySelector('.cx-mp-art'), host.querySelector('.cx-mp-art-in')]);
  });

  it('mirrors the horizontal position in a right-to-left page', async () => {
    const host = build();
    // A line that leans to the right in the SVG: x = 80 of 100.
    const line = host.querySelector('.cx-mp-p') as unknown as Record<string, unknown>;
    line.getTotalLength = () => 200;
    line.getPointAtLength = (at: number) => ({ x: 80, y: at });
    const svg = host.querySelector('svg')!;
    Object.defineProperty(svg, 'viewBox', { value: { baseVal: { width: 100, height: 200 } }, configurable: true });
    Object.defineProperty(line, 'ownerSVGElement', { value: svg, configurable: true });

    const ltr = fakeGsap(0.5);
    await path(host, context(host, ltr.bundle).ctx);
    expect(ltr.setters.find((s) => s.prop === 'x')!.values.at(-1)).toBe(30);

    const rtl = fakeGsap(0.5);
    await path(host, context(host, rtl.bundle, { rtl: true }).ctx);
    expect(rtl.setters.find((s) => s.prop === 'x')!.values.at(-1)).toBe(-30);
  });
});
