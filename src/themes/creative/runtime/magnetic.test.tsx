import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountMagnetic } from './magnetic';

let frames: Array<() => void> = [];
const flush = () => {
  const run = frames;
  frames = [];
  for (const cb of run) cb();
};

function pointer(type: string, target: Element, x = 0, y = 0, init: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, { bubbles: type !== 'pointerleave', clientX: x, clientY: y });
  for (const [k, v] of Object.entries(init)) Object.defineProperty(event, k, { value: v });
  target.dispatchEvent(event);
}

/** A store root with magnetic buttons in and outside the excluded areas. */
function mount() {
  const root = document.createElement('div');
  root.className = 'store-root';
  root.innerHTML = `
    <header><a id="in-header" data-cx-magnetic><span class="cx-btn-in">Menu</span></a></header>
    <main>
      <section data-section-key="hero-sunrise">
        <a id="hero" class="cx-btn" data-cx-magnetic><span class="cx-btn-in"><span id="label">Shop</span></span></a>
        <a id="other" class="cx-btn" data-cx-magnetic><span class="cx-btn-in">Story</span></a>
        <a id="plain">Plain link</a>
        <button id="off" data-cx-magnetic disabled>Off</button>
      </section>
      <section data-section-key="product-info"><a id="in-product" data-cx-magnetic>Buy</a></section>
      <section data-section-key="add-to-cart"><a id="in-cart" data-cx-magnetic>Add</a></section>
      <form><a id="in-form" data-cx-magnetic>Send</a></form>
      <div role="dialog"><a id="in-dialog" data-cx-magnetic>Close</a></div>
    </main>
    <footer><a id="in-footer" data-cx-magnetic>Top</a></footer>`;
  document.body.appendChild(root);
  const el = (id: string) => root.querySelector(`#${id}`) as HTMLElement;
  // 200 x 50 box with its centre at (200, 125).
  for (const a of Array.from(root.querySelectorAll<HTMLElement>('[data-cx-magnetic]'))) {
    a.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 50 }) as DOMRect;
  }
  return { root, el };
}

const pull = (el: HTMLElement) => [el.style.getPropertyValue('--cx-mx'), el.style.getPropertyValue('--cx-my')];

describe('mountMagnetic', () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pulls the target by 18 % of the pointer offset, one frame per move, also from a child', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    const hero = el('hero');
    pointer('pointerover', el('label'), 220, 135);
    expect(pull(hero)).toEqual(['', '']);
    expect(frames).toHaveLength(1);
    flush();
    expect(pull(hero)).toEqual(['3.60px', '1.80px']);

    pointer('pointermove', hero, 190, 115);
    pointer('pointermove', hero, 180, 120);
    expect(frames).toHaveLength(1);
    flush();
    expect(pull(hero)).toEqual(['-3.60px', '-0.90px']);
    off();
  });

  it('caps the pull at 8 px per axis', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    pointer('pointerover', el('hero'), 900, -400);
    flush();
    expect(pull(el('hero'))).toEqual(['8.00px', '-8.00px']);
    off();
  });

  it('releases on pointerleave and on blur, and stops listening to moves', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    const hero = el('hero');
    pointer('pointerover', hero, 220, 135);
    flush();
    pointer('pointerleave', hero);
    expect(pull(hero)).toEqual(['', '']);
    pointer('pointermove', root, 240, 140);
    expect(frames).toHaveLength(0);

    pointer('pointerover', hero, 220, 135);
    flush();
    hero.dispatchEvent(new FocusEvent('blur'));
    expect(pull(hero)).toEqual(['', '']);
    off();
  });

  it('moving to another button releases the first', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    pointer('pointerover', el('hero'), 220, 135);
    flush();
    pointer('pointerover', el('other'), 210, 125);
    flush();
    expect(pull(el('hero'))).toEqual(['', '']);
    expect(pull(el('other'))).toEqual(['1.80px', '0.00px']);
    off();
  });

  it('never pulls buy controls, forms, the store chrome, dialogs, disabled or plain elements', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    for (const id of ['in-header', 'in-footer', 'in-product', 'in-cart', 'in-form', 'in-dialog', 'off', 'plain']) {
      pointer('pointerover', el(id), 260, 140);
      expect(frames).toHaveLength(0);
      expect(pull(el(id))).toEqual(['', '']);
    }
    off();
  });

  it('ignores touch and pen pointers', () => {
    const { root, el } = mount();
    const off = mountMagnetic(root);
    pointer('pointerover', el('hero'), 220, 135, { pointerType: 'touch' });
    pointer('pointerover', el('hero'), 220, 135, { pointerType: 'pen' });
    expect(frames).toHaveLength(0);
    pointer('pointerover', el('hero'), 220, 135, { pointerType: 'mouse' });
    expect(frames).toHaveLength(1);
    off();
  });

  it('cleanup releases the active target, cancels the frame and removes every listener', () => {
    const { root, el } = mount();
    const added = vi.spyOn(root, 'addEventListener');
    const removed = vi.spyOn(root, 'removeEventListener');
    const off = mountMagnetic(root);
    const hero = el('hero');
    const heroRemoved = vi.spyOn(hero, 'removeEventListener');
    pointer('pointerover', hero, 220, 135);
    flush();
    pointer('pointermove', hero, 230, 135);
    expect(frames).toHaveLength(1);

    off();
    expect(frames).toHaveLength(0);
    expect(pull(hero)).toEqual(['', '']);
    expect(heroRemoved.mock.calls.map((c) => c[0]).sort()).toEqual(['blur', 'pointercancel', 'pointerleave']);
    const names = (calls: unknown[][]) => calls.map((c) => c[0]).sort();
    expect(names(removed.mock.calls)).toEqual(names(added.mock.calls));

    pointer('pointerover', hero, 220, 135);
    expect(frames).toHaveLength(0);
  });
});
