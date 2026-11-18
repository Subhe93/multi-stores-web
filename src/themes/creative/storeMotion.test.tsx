import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { SectionRenderer } from '../SectionRenderer';
import { minimalTheme } from '../minimal/theme';
import type { SectionDefinition, SectionInstance, SectionRenderProps, Theme } from '../types';
import { storeMotion, storeMotionOf } from './creativeAttrs';
import { BASE_CSS, G } from './css/base.css';
import { MOTION_CSS } from './css/motion.css';
import { MotionMedia, MotionText } from './primitives';
import { drift, fade, hover, item, line, magnetic, parallax, rise, stagger, surface } from './recipes';

// The general mechanism of the store motion style: one store switch, a
// `motion` prop per section from the renderer, recipe helpers that return
// nothing while it is off, and one per-section override.

const section = (
  id: string,
  section_key: string,
  settings: Record<string, unknown> = {},
  content: Record<string, unknown> = {},
): SectionInstance => ({
  id,
  section_key,
  settings,
  sort_order: Number(id.replace(/\D/g, '')) || 0,
  translations: [{ locale: 'en', content }],
});

// A probe section that prints the motion prop it received.
function Probe({ motion, content }: SectionRenderProps) {
  return (
    <div data-probe={motion ?? 'none'}>
      <h2 {...rise(motion)}>{String(content.heading ?? '')}</h2>
    </div>
  );
}
const probeDef: SectionDefinition = {
  schema: { id: 'probe', label: { en: 'Probe', ar: 'Probe' }, schema: [], translatable: [] } as never,
  Component: Probe,
  defaultSettings: {},
  defaultContent: {},
};
const theme: Theme = {
  ...minimalTheme,
  sections: { ...minimalTheme.sections, probe: probeDef, 'hero-probe': probeDef, 'product-page': probeDef },
};

const PAGE = [
  section('s1', 'hero-probe', {}, { heading: 'One' }),
  section('s2', 'probe', {}, { heading: 'Two' }),
  section('s3', 'probe', { _style: { motion: 'none' } }, { heading: 'Three' }),
  section('s4', 'product-page', {}, { heading: 'Four' }),
];

const render = (props: Partial<Parameters<typeof SectionRenderer>[0]> = {}) =>
  renderToStaticMarkup(
    <SectionRenderer theme={theme} sections={PAGE} locale="en" primaryLocale="en" storeSlug="demo" {...props} />,
  );

const wrapper = (html: string, id: string) => html.match(new RegExp(`<div[^>]*data-section-id="${id}"[^>]*>`))?.[0] || '';

describe('store switch', () => {
  it('is on only for theme_customizations.motion.creative.enabled === true', () => {
    expect(storeMotion(undefined)).toBe(false);
    expect(storeMotion({ motion: { reveal: 'calm' } })).toBe(false);
    expect(storeMotion({ motion: { creative: { enabled: true } } })).toBe(true);
    expect(storeMotionOf(null)).toBe(false);
    expect(storeMotionOf({ theme_customizations: { motion: { creative: { enabled: true } } } })).toBe(true);
    expect(storeMotionOf({ theme_key: 'minimal' })).toBe(false);
  });
});

describe('section renderer', () => {
  it('without the switch nothing changes: no attribute, no prop', () => {
    const off = render();
    expect(off).toBe(render({ motion: false }));
    expect(off).not.toMatch(/data-cx-/);
    expect(off.match(/data-probe="none"/g)).toHaveLength(4);
    // Today's reveal wrapper stays on the plain content section.
    expect(wrapper(off, 's2')).toContain('data-reveal="up"');
  });

  it('with the switch every section is a scope and gets its phase', () => {
    const on = render({ motion: true });
    // First section of the page: intro (plays on load).
    expect(wrapper(on, 's1')).toContain('data-cx-section="hero-probe"');
    expect(on).toContain('data-probe="intro"');
    expect(on).toContain('<h2 data-cx-intro="rise">One</h2>');
    // Later sections: scroll, the default treatment and no legacy reveal.
    expect(wrapper(on, 's2')).toContain('data-cx-section="probe"');
    expect(wrapper(on, 's2')).toContain('data-cx-auto=""');
    expect(wrapper(on, 's2')).not.toContain('data-reveal');
    expect(on).toContain('<h2 data-cx-reveal="rise">Two</h2>');
    // Commerce surfaces: fast timing, never the default treatment.
    expect(wrapper(on, 's4')).toContain('data-cx-tier="fast"');
    expect(wrapper(on, 's4')).not.toContain('data-cx-auto');
  });

  it('the per-section override "none" keeps that section static, with or without the switch', () => {
    const on = render({ motion: true });
    expect(wrapper(on, 's3')).not.toMatch(/data-cx-|data-reveal/);
    expect(on).toContain('<h2>Three</h2>');
    const off = render();
    expect(wrapper(off, 's3')).not.toMatch(/data-cx-|data-reveal/);
  });

  it('the builder preview never gets the motion markup', () => {
    expect(render({ motion: true, builderPreview: true })).not.toMatch(/data-cx-section|data-cx-reveal|data-cx-intro/);
  });

  it('chrome sections get the prop (scroll phase) but no wrapper scope', () => {
    const html = render({ motion: true, chrome: true });
    expect(html).not.toContain('data-cx-section');
    expect(html).not.toContain('data-probe="intro"');
    expect(html.match(/data-probe="scroll"/g)).toHaveLength(3);
  });

  it('a product template page is fast as a whole', () => {
    const html = render({ motion: true, product: { id: 'p1' } as never });
    expect(wrapper(html, 's2')).toContain('data-cx-tier="fast"');
    expect(wrapper(html, 's2')).not.toContain('data-cx-auto');
  });
});

describe('recipes', () => {
  it('return nothing without the motion prop', () => {
    for (const attrs of [
      rise(undefined, { i: 2, d: 3 }),
      fade(undefined),
      line(undefined),
      stagger(undefined),
      item(undefined, 3),
      hover(undefined, 'lift'),
      magnetic(undefined),
      parallax(undefined),
      surface(undefined, 'cart', true),
    ]) {
      expect(Object.keys(attrs)).toHaveLength(0);
    }
    expect(renderToStaticMarkup(<h2><MotionText motion={undefined} text="Plain text" /></h2>)).toBe('<h2>Plain text</h2>');
    expect(
      renderToStaticMarkup(
        <MotionMedia motion={undefined}>
          <span>media</span>
        </MotionMedia>,
      ),
    ).toBe('<span>media</span>');
  });

  it('intro and scroll use the two attribute families', () => {
    expect(rise('intro', { i: 2, d: 3 })).toEqual({ 'data-cx-intro': 'rise', 'data-cx-i': '2', 'data-cx-d': '3' });
    expect(rise('scroll')).toEqual({ 'data-cx-reveal': 'rise' });
    expect(line('intro')).toEqual({ 'data-cx-intro': 'rule' });
    expect(line('scroll')).toEqual({ 'data-cx-reveal': 'line' });
    expect(stagger('scroll')).toEqual({ 'data-cx-reveal': 'stagger' });
    expect(stagger('intro')).toEqual({});
    expect(item('scroll', 4)).toEqual({ 'data-cx-item': '' });
    expect(item('intro', 0)).toEqual({ 'data-cx-intro': 'rise' });
    expect(item('intro', 9)).toEqual({ 'data-cx-intro': 'rise', 'data-cx-i': '5' });
  });

  it('steps and delays are clamped to what the stylesheet knows', () => {
    expect(rise('scroll', { i: 40, d: 99 })).toEqual({ 'data-cx-reveal': 'rise', 'data-cx-i': '8', 'data-cx-d': '12' });
    expect(rise('scroll', { i: -1, d: Number.NaN })).toEqual({ 'data-cx-reveal': 'rise' });
    for (let n = 1; n <= 8; n++) expect(MOTION_CSS).toContain(`[data-cx-i="${n}"]{--cx-i:${n}}`);
    expect(MOTION_CSS).toContain('[data-cx-d="12"]{--cx-delay:1.2s}');
  });

  it('parallax is a scrub layer with a bounded travel; surface marks a scope', () => {
    expect(parallax('scroll')).toEqual({ 'data-cx-behavior': 'scrub', 'data-cx-y': '-6' });
    expect(drift('scroll')).toEqual({ 'data-cx-behavior': 'scrub', 'data-cx-drift': '', 'data-cx-y': '-8' });
    expect(drift('intro', { y: -40, rotate: 6 })).toEqual({ 'data-cx-behavior': 'scrub', 'data-cx-drift': '', 'data-cx-y': '-12', 'data-cx-rotate': '6' });
    expect(drift(undefined)).toEqual({});
    expect(MOTION_CSS).toContain('[data-cx-y]:not([data-cx-drift]){scale:1.14}');
    expect(parallax('scroll', -40)['data-cx-y']).toBe('-12');
    expect(surface('scroll', 'cart', true)).toEqual({ 'data-cx-section': 'cart', 'data-cx-tier': 'fast' });
    expect(surface('scroll', 'header')).toEqual({ 'data-cx-section': 'header' });
  });

  it('heading-lines keeps the text and never splits Arabic into characters', () => {
    const en = renderToStaticMarkup(<h2><MotionText motion="scroll" text={'Every purchase.\nA chance to learn.'} /></h2>);
    expect(en).toContain('data-cx-reveal="words"');
    expect(en.replace(/<[^>]+>/g, '')).toBe('Every purchase.\nA chance to learn.');
    const ar = renderToStaticMarkup(<h1><MotionText motion="intro" text="كل عملية شراء" /></h1>);
    expect(ar).toContain('data-cx-intro="words"');
    expect([...ar.matchAll(/class="cx-wi"[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(['كل', 'عملية', 'شراء']);
  });

  it('media-mask clips on scroll and only settles for an intro or a priority image', () => {
    const img = <span>media</span>;
    expect(renderToStaticMarkup(<MotionMedia motion="scroll" dir="start">{img}</MotionMedia>)).toContain(
      'data-cx-reveal="mask" data-cx-dir="start"',
    );
    for (const html of [
      renderToStaticMarkup(<MotionMedia motion="intro">{img}</MotionMedia>),
      renderToStaticMarkup(<MotionMedia motion="scroll" priority>{img}</MotionMedia>),
    ]) {
      expect(html).toContain('data-cx-intro="scale"');
      expect(html).not.toContain('data-cx-reveal');
    }
  });
});

describe('stylesheets', () => {
  it('the recipe stylesheet moves or hides nothing outside the gate', () => {
    for (const rule of MOTION_CSS.split(':is(img,video)').join('img').split('}')) {
      const [selector, body = ''] = rule.split('{').slice(-2);
      if (!/translate|scale|transition|background-size/.test(body)) continue;
      for (const part of selector.split(',')) {
        expect(part.trim().startsWith('html[data-cx-motion] .store-root'), part).toBe(true);
      }
    }
    expect(G).toContain(':not([data-motion-reveal="off"])');
  });

  it('carries the numbers of the motion vocabulary', () => {
    expect(BASE_CSS).toContain('--cx-ease:cubic-bezier(.16,1,.3,1)');
    expect(BASE_CSS).toContain('--cx-dur:1.2s');
    expect(BASE_CSS).toContain('--cx-dur-clip:1.3s');
    expect(BASE_CSS).toContain('--cx-dur-settle:1.7s');
    expect(BASE_CSS).toContain('transform:scale(1.16)');
    expect(BASE_CSS).toContain('[data-cx-tier="fast"]{--cx-dur:.6s');
    expect(MOTION_CSS).toContain('scale:1.045');
  });

  it('hover recipes need a fine pointer', () => {
    const fine = MOTION_CSS.slice(MOTION_CSS.indexOf('@media (hover:hover) and (pointer:fine){'));
    expect(fine).toContain('[data-cx-hover="lift"]:hover{translate:0 -4px}');
    expect(MOTION_CSS.indexOf('[data-cx-hover="lift"]')).toBeGreaterThan(MOTION_CSS.indexOf('@media (hover:hover)'));
  });
});

// ── Engine: default treatment, stagger rows, line grouping ───────────────

describe('engine core: automatic treatment', () => {
  const observers: Array<{ cb: IntersectionObserverCallback; els: Set<Element> }> = [];

  function place(el: HTMLElement, top: number, left = 0) {
    el.getBoundingClientRect = () =>
      ({ top, bottom: top + 100, left, right: left + 100, width: 100, height: 100, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  }
  const enter = (el: Element) => {
    for (const o of observers) {
      if (o.els.has(el)) o.cb([{ target: el, isIntersecting: true } as IntersectionObserverEntry], o as never);
    }
  };

  beforeEach(() => {
    vi.resetModules();
    observers.length = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        els = new Set<Element>();
        constructor(public cb: IntersectionObserverCallback) {
          observers.push(this as never);
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
      },
    );
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    document.documentElement.setAttribute('data-cx-motion', '');
    document.body.innerHTML = '<div class="store-root"><main></main></div>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-cx-motion');
  });

  function mount(html: string): HTMLElement {
    const main = document.querySelector('main') as HTMLElement;
    main.innerHTML = html;
    const scope = main.firstElementChild as HTMLElement;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>('*'))) place(el, 2000);
    place(scope, 2000);
    return scope;
  }

  it('a section without recipes: its blocks rise in sequence, alike children cascade', async () => {
    const scope = mount(
      '<div data-cx-section="x" data-cx-auto=""><div class="inner"><section><h2>T</h2><p>Text</p><ul><li>a</li><li>b</li><li>c</li></ul></section></div></div>',
    );
    const { register } = await import('./engine/core');
    const off = register(scope);
    const h2 = scope.querySelector('h2') as HTMLElement;
    const p = scope.querySelector('p') as HTMLElement;
    const ul = scope.querySelector('ul') as HTMLElement;
    expect(h2.getAttribute('data-cx-reveal')).toBe('rise');
    expect(p.getAttribute('data-cx-reveal')).toBe('rise');
    expect(p.style.getPropertyValue('--cx-i')).toBe('1');
    expect(ul.getAttribute('data-cx-reveal')).toBe('stagger');
    // The container itself is never hidden; its items are.
    expect(ul.hasAttribute('data-cx-state')).toBe(false);
    const items = Array.from(ul.children) as HTMLElement[];
    expect(items.map((li) => li.getAttribute('data-cx-state'))).toEqual(['pending', 'pending', 'pending']);
    off();
    // Everything the engine tagged is untagged again.
    expect(scope.innerHTML).not.toMatch(/data-cx-reveal|data-cx-state|data-cx-tagged|--cx-i/);
  });

  it('a section with recipes of its own is left alone', async () => {
    const scope = mount(
      '<div data-cx-section="x" data-cx-auto=""><div><h2 data-cx-reveal="rise">T</h2><p>Text</p></div></div>',
    );
    const { register } = await import('./engine/core');
    const off = register(scope);
    expect(scope.querySelector('p')?.hasAttribute('data-cx-reveal')).toBe(false);
    off();
  });

  it('stagger: each item waits for its place in its own row, capped', async () => {
    const scope = mount(
      '<div data-cx-section="x"><ul data-cx-reveal="stagger">' +
        Array.from({ length: 9 }, (_, i) => `<li data-cx-item="">${i}</li>`).join('') +
        '</ul></div>',
    );
    const items = Array.from(scope.querySelectorAll<HTMLElement>('li'));
    // Two rows: seven cards, then two.
    items.forEach((li, i) => place(li, i < 7 ? 2000 : 2300, (i % 7) * 120));
    const { register } = await import('./engine/core');
    const off = register(scope);
    expect(items.map((li) => li.style.getPropertyValue('--cx-i'))).toEqual(['', '1', '2', '3', '4', '5', '5', '', '1']);
    expect(items.every((li) => li.getAttribute('data-cx-reveal') === 'rise')).toBe(true);
    off();
  });

  it('a shown element settles back to its own styles; added cards are armed by rearm()', async () => {
    vi.useFakeTimers();
    const scope = mount('<div data-cx-section="x"><ul data-cx-reveal="stagger"><li data-cx-item="">a</li></ul></div>');
    const { register, rearm } = await import('./engine/core');
    const off = register(scope);
    const first = scope.querySelector('li') as HTMLElement;
    enter(first);
    expect(first.getAttribute('data-cx-state')).toBe('shown');
    vi.advanceTimersByTime(3300);
    expect(first.getAttribute('data-cx-state')).toBe('done');

    const added = document.createElement('li');
    added.setAttribute('data-cx-item', '');
    place(added, 2400);
    scope.querySelector('ul')?.appendChild(added);
    rearm(scope);
    expect(added.getAttribute('data-cx-state')).toBe('pending');
    expect(first.getAttribute('data-cx-state')).toBe('done');
    off();
  });

  it('heading-lines: words on the same line share one delay', async () => {
    const scope = mount(
      '<div data-cx-section="x"><h2><span class="cx-ht" data-cx-reveal="words">' +
        ['a', 'b', 'c', 'd'].map((w) => `<span class="cx-w"><span class="cx-wi">${w}</span></span>`).join(' ') +
        '</span></h2></div>',
    );
    const wraps = Array.from(scope.querySelectorAll<HTMLElement>('.cx-w'));
    wraps.forEach((w, i) => Object.defineProperty(w, 'offsetTop', { value: i < 2 ? 0 : 40 }));
    const { register } = await import('./engine/core');
    const off = register(scope);
    const delays = Array.from(scope.querySelectorAll<HTMLElement>('.cx-wi')).map((w) => w.style.getPropertyValue('--cx-ld'));
    expect(delays).toEqual(['0.00s', '0.00s', '0.10s', '0.10s']);
    off();
    expect(scope.innerHTML).not.toContain('--cx-ld');
  });
});

describe('section scan', () => {
  it('registers every marked section, follows the page as it changes and cleans up', async () => {
    vi.resetModules();
    const offs: Array<ReturnType<typeof vi.fn>> = [];
    const register = vi.fn((el: HTMLElement) => {
      void el;
      const off = vi.fn();
      offs.push(off);
      return off;
    });
    const rearm = vi.fn();
    vi.doMock('./engine/core', () => ({ register, rearm, isRegistered: () => true }));
    let raf: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      raf = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      raf = null;
    });
    document.body.innerHTML =
      '<div class="store-root"><div data-cx-section="a" id="a"></div><div data-cx-section="b" id="b"></div></div>';
    const root = document.querySelector('.store-root') as HTMLElement;
    const { startScan } = await import('./runtime/scan');
    const stop = startScan(root);
    expect(register).toHaveBeenCalledTimes(2);

    // Client navigation: one section leaves, a new one arrives.
    document.getElementById('a')?.remove();
    root.insertAdjacentHTML('beforeend', '<div data-cx-section="c" id="c"></div>');
    await Promise.resolve();
    (raf as FrameRequestCallback | null)?.(0);
    expect(offs[0]).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(3);
    expect(rearm).toHaveBeenCalledWith(document.getElementById('b'));

    stop();
    expect(offs[1]).toHaveBeenCalledTimes(1);
    expect(offs[2]).toHaveBeenCalledTimes(1);
    vi.doUnmock('./engine/core');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });
});
