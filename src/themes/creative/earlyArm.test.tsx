import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EARLY_ARM_SCRIPT, EARLY_ATTR } from './earlyArm';
import { MOTION_FLAG_SCRIPT } from './motionFlag';
import { StoreMotionAssets } from './primitives/StoreMotionAssets';

// ── Browser stubs ───────────────────────────────────────────────────────

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

class FakeRO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const enter = (el: Element) => {
  for (const io of [...FakeIO.all]) if (io.els.has(el)) io.fire(el);
};
const watchers = (el: Element) => FakeIO.all.filter((io) => io.els.has(el));

let frames: Array<() => void> = [];
/** Runs the queued animation frames (the early script batches its passes per frame). */
const frame = () => {
  const run = frames;
  frames = [];
  for (const fn of run) fn();
};
/** Lets MutationObserver records be delivered, then runs the frame they scheduled. */
const settle = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  frame();
};

function place(el: Element, top: number) {
  (el as HTMLElement).getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 300, width: 300, height: 40 }) as DOMRect;
}

const SECTIONS = `
  <section data-cx-section="recipes" id="recipes">
    <h2><span data-cx-reveal="words" id="words"><span class="cx-w"><span class="cx-wi">One</span></span> <span class="cx-w"><span class="cx-wi">two</span></span></span></h2>
    <p data-cx-reveal="rise" id="near">Near</p>
    <p data-cx-reveal="rise" id="far">Far</p>
    <div><div class="cx-mask" data-cx-reveal="mask" id="mask"><span class="cx-mask-in">image</span></div></div>
    <ul data-cx-reveal="stagger" id="grid"><li id="c1">1</li><li id="c2">2</li><li id="c3">3</li></ul>
  </section>
  <section data-cx-section="plain" data-cx-auto="" id="plain">
    <div><h3 id="a1">Title</h3><p id="a2">Text</p><ul id="a3"><li>x</li><li>y</li><li>z</li></ul></div>
  </section>`;

function mount(rootAttrs: Record<string, string> = {}, html = SECTIONS) {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'store-root';
  for (const [k, v] of Object.entries(rootAttrs)) root.setAttribute(k, v);
  root.innerHTML = `<main>${html}</main>`;
  document.body.appendChild(root);
  layout(root);
  return root;
}

/** jsdom has no layout: "near" is on screen, everything else below the fold. */
function layout(root: ParentNode) {
  for (const el of Array.from(root.querySelectorAll('*'))) place(el, 3000);
  const near = root.querySelector('#near');
  if (near) place(near, 100);
}

const runFlag = () => new Function(MOTION_FLAG_SCRIPT)();
const runEarly = () => new Function(EARLY_ARM_SCRIPT)();
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const state = (id: string) => $(id).getAttribute('data-cx-state');

/** The markup with the hand-over markers removed, to compare the two arming paths. */
const normal = (html: string) => html.replace(/ data-cx-early=""/g, '').replace(/data-cx-tagged="early"/g, 'data-cx-tagged=""');

describe('early arming of the reveals', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeIO.all = [];
    frames = [];
    vi.stubGlobal('IntersectionObserver', FakeIO);
    vi.stubGlobal('ResizeObserver', FakeRO);
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {} })),
    );
    window.sessionStorage.clear();
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });
  afterEach(() => {
    window.__cxEarly?.stop();
    delete window.__cxEarly;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-cx-motion');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is part of the assets of a store with the motion style, after the gate script', () => {
    const html = renderToStaticMarkup(<StoreMotionAssets />);
    const gate = html.indexOf(MOTION_FLAG_SCRIPT.slice(0, 40));
    const early = html.indexOf('data-cx-early-script');
    expect(gate).toBeGreaterThan(-1);
    expect(early).toBeGreaterThan(gate);
    expect(EARLY_ARM_SCRIPT).not.toContain('</script');
  });

  it('does nothing while the gate is closed (reduced motion, no flag script)', () => {
    mount();
    runEarly();
    frame();
    expect(window.__cxEarly).toBeUndefined();
    expect(document.body.innerHTML).not.toMatch(/data-cx-state|data-cx-tagged/);
  });

  it('leaves a store with motion off and the builder preview static', () => {
    for (const attrs of [{ 'data-motion-reveal': 'off' }, { 'data-cx-builder': '' }] as Array<Record<string, string>>) {
      mount(attrs);
      runFlag();
      runEarly();
      frame();
      expect(document.body.innerHTML).not.toMatch(/data-cx-state|data-cx-tagged/);
      window.__cxEarly?.stop();
      delete window.__cxEarly;
    }
  });

  it('arms without the engine: on screen stays at rest, below waits, entry shows, then settles', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mount();
    runFlag();
    runEarly();
    // Nothing before the first frame, everything in it.
    expect(state('far')).toBeNull();
    frame();
    expect(state('near')).toBe('done');
    expect(state('far')).toBe('pending');
    expect($('far').hasAttribute(EARLY_ATTR)).toBe(true);
    // Stagger items and the blocks of an untouched section are tagged like the core does.
    expect($('c2').getAttribute('data-cx-reveal')).toBe('rise');
    expect($('c2').getAttribute('data-cx-tagged')).toBe('early');
    expect($('a2').style.getPropertyValue('--cx-i')).toBe('1');
    expect($('a3').getAttribute('data-cx-reveal')).toBe('stagger');
    // A mask is observed through its unclipped parent.
    expect(watchers($('mask'))).toHaveLength(0);
    expect(watchers($('mask').parentElement as Element)).toHaveLength(1);

    enter($('far'));
    expect(state('far')).toBe('shown');
    expect(watchers($('far'))).toHaveLength(0);
    enter($('mask').parentElement as Element);
    expect(state('mask')).toBe('shown');
    vi.advanceTimersByTime(3300);
    expect(state('far')).toBe('done');
  });

  it('produces the same markup as the engine core on the same page', async () => {
    mount();
    runFlag();
    runEarly();
    frame();
    const early = normal(document.body.innerHTML);
    window.__cxEarly?.stop();
    delete window.__cxEarly;

    const root = mount();
    const core = await import('./engine/core');
    const offs = Array.from(root.querySelectorAll<HTMLElement>('[data-cx-section]')).map((el) => core.register(el));
    const fromCore = document.body.innerHTML.replace(/ data-cx-watch=""/g, '');
    expect(early).toBe(fromCore);
    for (const off of offs) off();
  });

  it('waits for a section the parser is still inside, and for one in a hidden streaming container', async () => {
    const root = mount({}, '');
    runFlag();
    runEarly();
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    try {
      const main = root.querySelector('main') as HTMLElement;
      // The last node of the document so far: its content may be incomplete.
      main.innerHTML = '<section data-cx-section="open" id="open"><p data-cx-reveal="rise" id="p1">x</p></section>';
      layout(main);
      await settle();
      expect(state('p1')).toBeNull();
      // The parser moved on: the section is complete.
      main.appendChild(document.createElement('footer'));
      await settle();
      expect(state('p1')).toBe('pending');

      const holder = document.createElement('div');
      holder.hidden = true;
      holder.innerHTML = '<section data-cx-section="late" id="late"><p data-cx-reveal="rise" id="p2">y</p></section>';
      layout(holder);
      main.insertBefore(holder, main.lastChild);
      await settle();
      expect(state('p2')).toBeNull();
      // React moves the streamed content into place.
      main.insertBefore($('late'), holder);
      await settle();
      expect(state('p2')).toBe('pending');
    } finally {
      delete (document as unknown as { readyState?: string }).readyState;
    }
  });

  it('arms what a client navigation adds until the engine takes over, and forgets what left', async () => {
    const root = mount();
    runFlag();
    runEarly();
    frame();
    const far = $('far');
    expect(watchers(far)).toHaveLength(1);
    const main = root.querySelector('main') as HTMLElement;
    main.innerHTML = '<section data-cx-section="next"><p data-cx-reveal="rise" id="n1">next</p></section>';
    layout(main);
    await settle();
    expect(state('n1')).toBe('pending');
    expect(watchers(far)).toHaveLength(0);

    window.__cxEarly?.stop();
    main.innerHTML = '<section data-cx-section="third"><p data-cx-reveal="rise" id="t1">third</p></section>';
    layout(main);
    await settle();
    expect(state('t1')).toBeNull();
  });
});

describe('adoption by the engine', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeIO.all = [];
    frames = [];
    vi.stubGlobal('IntersectionObserver', FakeIO);
    vi.stubGlobal('ResizeObserver', FakeRO);
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {} })),
    );
    window.sessionStorage.clear();
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });
  afterEach(() => {
    window.__cxEarly?.stop();
    delete window.__cxEarly;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-cx-motion');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps every state as it is: no second arming, one observer, the cleanup of the core', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const root = mount();
    runFlag();
    runEarly();
    frame();
    // The visitor scrolled before the engine arrived: one element is already entering.
    enter($('c1'));
    expect(state('c1')).toBe('shown');
    const before = normal(document.body.innerHTML);
    const earlyIOs = [...FakeIO.all];

    // Every write of a state attribute from here on.
    const writes: string[] = [];
    const setAttribute = Element.prototype.setAttribute;
    const spy = vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (this: Element, name: string, value: string) {
      if (name === 'data-cx-state') writes.push(`${this.id}:${value}`);
      return setAttribute.call(this, name, value);
    });

    const core = await import('./engine/core');
    const scan = await import('./runtime/scan');
    const stopEarly = vi.spyOn(window.__cxEarly as NonNullable<typeof window.__cxEarly>, 'stop');
    const stop = scan.startScan(root);
    expect(stopEarly).toHaveBeenCalledTimes(1);
    expect(core.isRegistered($('recipes'))).toBe(true);

    // Same page: nothing was re-armed, re-hidden or re-tagged.
    expect(writes).toEqual([]);
    expect(document.body.innerHTML.replace(/ data-cx-watch=""/g, '')).toBe(before);
    expect(document.body.innerHTML).not.toContain(EARLY_ATTR);
    expect(document.body.innerHTML).not.toContain('data-cx-tagged="early"');
    // The early observers let go; the core watches each pending element once.
    for (const io of earlyIOs) expect(io.els.size).toBe(0);
    expect(watchers($('far'))).toHaveLength(1);
    expect(watchers($('mask').parentElement as Element)).toHaveLength(1);

    // The core plays the entrance and the settle of what it adopted.
    enter($('far'));
    expect(state('far')).toBe('shown');
    vi.advanceTimersByTime(3300);
    expect(state('far')).toBe('done');
    expect(state('c1')).toBe('done');

    spy.mockRestore();
    stop();
    expect(document.body.innerHTML).not.toMatch(/data-cx-state|data-cx-tagged|--cx-i|--cx-ld|data-cx-early/);
    expect($('c1').hasAttribute('data-cx-reveal')).toBe(false);
    expect($('far').getAttribute('data-cx-reveal')).toBe('rise');
  });

  it('an element the visitor already reached is not hidden again by the late engine', async () => {
    const root = mount();
    runFlag();
    runEarly();
    frame();
    // Scrolled: "far" is now on screen and the observer has not reported yet.
    place($('far'), 200);
    const core = await import('./engine/core');
    const off = core.register(root.querySelector('#recipes') as HTMLElement);
    // Still pending (the transition has to start from the hidden state), and
    // the core's observer shows it at once: never set to "done" without it.
    expect(state('far')).toBe('pending');
    enter($('far'));
    expect(state('far')).toBe('shown');
    off();
  });

  it('without the early script the core arms as before', async () => {
    const root = mount();
    runFlag();
    const core = await import('./engine/core');
    const off = core.register(root.querySelector('#recipes') as HTMLElement);
    expect(state('near')).toBe('done');
    expect(state('far')).toBe('pending');
    off();
    expect(document.body.innerHTML).not.toMatch(/data-cx-state/);
  });
});
