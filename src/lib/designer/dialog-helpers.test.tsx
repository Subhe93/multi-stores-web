import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOCUSABLE_SELECTOR, focusableIn, trapTabKey } from './focus-trap';
import { lockBodyScroll } from './scroll-lock';

describe('focus trap (D30)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('counts selects, textareas, role=button and tabindex=0 elements', () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="b1">b</button>
        <input id="i1" />
        <input id="skip" tabindex="-1" />
        <select id="s1"><option>a</option></select>
        <textarea id="t1"></textarea>
        <div id="rb" role="button" tabindex="0">custom</div>
        <canvas id="c1" tabindex="0"></canvas>
        <a id="a1" href="#x">link</a>
        <button id="dis" disabled>off</button>
        <span id="sp" tabindex="0">span</span>
      </div>`;
    const root = document.getElementById('root')!;
    expect(FOCUSABLE_SELECTOR).toContain('select');
    expect(FOCUSABLE_SELECTOR).toContain('textarea');
    expect(FOCUSABLE_SELECTOR).toContain('[role="button"]');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex="0"]');
    expect(focusableIn(root).map((e) => e.id)).toEqual(['b1', 'i1', 's1', 't1', 'rb', 'c1', 'a1', 'sp']);
  });

  it('wraps Tab from the last element and Shift+Tab from the first', () => {
    document.body.innerHTML = `<div id="root"><button id="first">a</button><select id="last"><option>x</option></select></div>`;
    const root = document.getElementById('root')!;
    const first = document.getElementById('first')!;
    const last = document.getElementById('last')!;
    last.focus();
    expect(trapTabKey(root, { key: 'Tab', shiftKey: false })).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(trapTabKey(root, { key: 'Tab', shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(last);
    // In the middle nothing is forced.
    first.focus();
    expect(trapTabKey(root, { key: 'Tab', shiftKey: false })).toBe(false);
    expect(trapTabKey(root, { key: 'Enter', shiftKey: false })).toBe(false);
  });
});

describe('body scroll lock (D15)', () => {
  it('fixes the body at the scroll offset and restores it on unlock', () => {
    vi.stubGlobal('scrollY', 120);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    document.body.style.overflow = 'auto';
    const unlock = lockBodyScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-120px');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('contain');
    // A nested lock neither re-locks nor unlocks the first one.
    const inner = lockBodyScroll();
    inner();
    expect(document.body.style.position).toBe('fixed');
    unlock();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    expect(scrollTo).toHaveBeenCalledWith(0, 120);
    unlock();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
