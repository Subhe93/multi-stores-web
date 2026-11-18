import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountProgress } from './progress';

let frames: Array<() => void> = [];
const flush = () => {
  const run = frames;
  frames = [];
  for (const cb of run) cb();
};

const bar = () => document.querySelector('[data-cx-progress]') as HTMLElement | null;

let root: HTMLElement;
let observed: Element[] = [];
let disconnects = 0;
let resizeCallback: (() => void) | null = null;

function page(scrollHeight: number, innerHeight: number, scrollY: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

describe('mountProgress', () => {
  beforeEach(() => {
    frames = [];
    observed = [];
    disconnects = 0;
    resizeCallback = null;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {
          disconnects += 1;
        }
      },
    );
    document.body.innerHTML = '<div class="store-root" style="--theme-colors-accent: #A38250"></div>';
    root = document.querySelector('.store-root') as HTMLElement;
    page(3000, 1000, 0);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = '';
    document.body.innerHTML = '';
  });

  it('mounts one decorative 2 px line on <body> in the accent colour, empty at the top', () => {
    const off = mountProgress(root);
    const el = bar() as HTMLElement;
    expect(el.parentElement).toBe(document.body);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.position).toBe('fixed');
    expect(el.style.top).toBe('0px');
    expect(el.style.height).toBe('2px');
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.background).toContain('rgb(163, 130, 80)');
    expect(el.style.transform).toBe('scaleX(0)');
    flush();
    expect(el.style.transform).toBe('scaleX(0.0000)');
    expect(el.style.opacity).toBe('1');
    expect(document.querySelectorAll('[data-cx-progress]')).toHaveLength(1);
    off();
  });

  it('follows the scroll position, one frame per burst of scroll events', () => {
    const off = mountProgress(root);
    flush();
    page(3000, 1000, 500);
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(1);
    flush();
    expect(bar()?.style.transform).toBe('scaleX(0.2500)');
    page(3000, 1000, 2600);
    window.dispatchEvent(new Event('scroll'));
    flush();
    // Overscroll never exceeds the full width.
    expect(bar()?.style.transform).toBe('scaleX(1.0000)');
    off();
  });

  it('grows from the inline start: the right edge in a right-to-left store', () => {
    const off = mountProgress(root);
    flush();
    expect(bar()?.style.transformOrigin).toBe('0 50%');
    root.setAttribute('dir', 'rtl');
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(bar()?.style.transformOrigin).toBe('100% 50%');
    off();
  });

  it('a page with nothing to scroll shows no bar; it returns when the page grows', () => {
    page(1040, 1000, 0);
    const off = mountProgress(root);
    flush();
    expect(bar()?.style.opacity).toBe('0');
    expect(observed).toEqual([root]);
    page(4000, 1000, 1500);
    resizeCallback?.();
    flush();
    expect(bar()?.style.opacity).toBe('1');
    expect(bar()?.style.transform).toBe('scaleX(0.5000)');
    off();
  });

  it('keeps its value while a drawer or dialog locks the page', () => {
    const off = mountProgress(root);
    page(3000, 1000, 1000);
    flush();
    expect(bar()?.style.transform).toBe('scaleX(0.5000)');
    // A lock pins the body: scrollY reads 0 until it is released.
    document.body.style.overflow = 'hidden';
    page(3000, 1000, 0);
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(bar()?.style.transform).toBe('scaleX(0.5000)');
    document.body.style.overflow = '';
    page(3000, 1000, 1000);
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(bar()?.style.transform).toBe('scaleX(0.5000)');
    off();
  });

  it('cleanup removes the node, both listeners, the observer and the pending frame', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const off = mountProgress(root);
    expect(added).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(added).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    expect(frames).toHaveLength(1);
    off();
    expect(bar()).toBeNull();
    expect(frames).toHaveLength(0);
    expect(disconnects).toBe(1);
    const scroll = added.mock.calls.find((c) => c[0] === 'scroll')?.[1];
    const resize = added.mock.calls.find((c) => c[0] === 'resize')?.[1];
    expect(removed).toHaveBeenCalledWith('scroll', scroll);
    expect(removed).toHaveBeenCalledWith('resize', resize);
    window.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(0);
    added.mockRestore();
    removed.mockRestore();
  });
});
