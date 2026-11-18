import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { Counter } from './Counter';
import { prefersReducedMotion, storeMotionOff } from './inView';

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let ioCallback: IOCallback | null = null;
let observed = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ioCallback = null;
  observed = 0;
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe() {
        observed += 1;
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** A store root as the layout renders it, with the given motion attribute. */
function storeRoot(reveal?: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'store-root min-h-screen';
  if (reveal) root.setAttribute('data-motion-reveal', reveal);
  document.body.appendChild(root);
  return root;
}

describe('store motion "off" on the JS side', () => {
  it('storeMotionOff / prefersReducedMotion are true only for data-motion-reveal="off"', () => {
    expect(storeMotionOff()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);

    const none = storeRoot();
    expect(prefersReducedMotion()).toBe(false);
    none.remove();

    const calm = storeRoot('calm');
    expect(storeMotionOff()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
    calm.remove();

    storeRoot('off');
    expect(storeMotionOff()).toBe(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('the attribute must sit on the store root itself', () => {
    const el = document.createElement('div');
    el.setAttribute('data-motion-reveal', 'off');
    document.body.appendChild(el);
    expect(storeMotionOff()).toBe(false);
  });

  it('the zoom attribute alone does not stop JS motion', () => {
    const root = storeRoot();
    root.setAttribute('data-motion-zoom', 'off');
    expect(prefersReducedMotion()).toBe(false);
  });

  it('still honours the visitor preference without the attribute', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(storeMotionOff()).toBe(false);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('Counter shows the final value at once and never observes when motion is off', () => {
    const root = storeRoot('off');
    const { container } = render(<Counter value="10,000" />, { container: root });
    const span = container.firstElementChild as HTMLElement;
    expect(span.textContent).toBe('10,000');
    expect(observed).toBe(0);
    expect(ioCallback).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(span.textContent).toBe('10,000');
  });

  it('Counter still counts up under "calm"', () => {
    const root = storeRoot('calm');
    const { container } = render(<Counter value="10,000" />, { container: root });
    const span = container.firstElementChild as HTMLElement;
    expect(observed).toBe(1);
    act(() => ioCallback?.([{ isIntersecting: true, target: span }]));
    expect(span.textContent).toBe('0');
    act(() => vi.advanceTimersByTime(1500));
    expect(span.textContent).toBe('10,000');
  });
});
