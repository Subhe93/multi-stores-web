import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeaderScrollState } from './HeaderScrollState.client';

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
interface FakeObserver {
  cb: IOCallback;
  options?: { rootMargin?: string };
  observed: Element[];
  disconnected: boolean;
}

let instances: FakeObserver[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  instances = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private self: FakeObserver;
      constructor(cb: IOCallback, options?: { rootMargin?: string }) {
        this.self = { cb, options, observed: [], disconnected: false };
        instances.push(this.self);
      }
      observe(el: Element) {
        this.self.observed.push(el);
      }
      unobserve() {}
      disconnect() {
        this.self.disconnected = true;
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <div>
      <HeaderScrollState />
      <header data-testid="header" />
      <main />
    </div>,
  );
}

describe('HeaderScrollState', () => {
  it('renders a hidden sentinel that takes no room', () => {
    expect(renderToStaticMarkup(<HeaderScrollState />)).toBe(
      '<span data-header-sentinel="" aria-hidden="true" style="display:block;height:1px;margin-block-end:-1px;pointer-events:none"></span>',
    );
  });

  it('observes the sentinel with one observer and mirrors it as data-scrolled on the next sibling', () => {
    const { container, getByTestId } = mount();
    const sentinel = container.querySelector('[data-header-sentinel]')!;
    const header = getByTestId('header');
    expect(instances).toHaveLength(1);
    expect(instances[0].observed).toEqual([sentinel]);
    // Nothing is written before the observer reports.
    expect(header.hasAttribute('data-scrolled')).toBe(false);

    act(() => instances[0].cb([{ isIntersecting: true, target: sentinel }]));
    expect(header.getAttribute('data-scrolled')).toBe('false');
    act(() => instances[0].cb([{ isIntersecting: false, target: sentinel }]));
    expect(header.getAttribute('data-scrolled')).toBe('true');
    act(() => instances[0].cb([{ isIntersecting: true, target: sentinel }]));
    expect(header.getAttribute('data-scrolled')).toBe('false');
    // Only the header is touched.
    expect(container.querySelector('main')!.hasAttribute('data-scrolled')).toBe(false);
  });

  it('waits for the height the compact header gives up (0.75rem) before it reports "scrolled"', () => {
    // The observed viewport reaches that far above the real one, so the
    // content below has reached the compact header's edge when it shrinks.
    mount();
    expect(instances[0].options).toEqual({ rootMargin: '12px 0px 0px 0px' });
  });

  it('follows the root font size', () => {
    document.documentElement.style.fontSize = '20px';
    try {
      mount();
      expect(instances[0].options).toEqual({ rootMargin: '15px 0px 0px 0px' });
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  it('takes the last record when several arrive at once', () => {
    const { container, getByTestId } = mount();
    const sentinel = container.querySelector('[data-header-sentinel]')!;
    act(() =>
      instances[0].cb([
        { isIntersecting: true, target: sentinel },
        { isIntersecting: false, target: sentinel },
      ]),
    );
    expect(getByTestId('header').getAttribute('data-scrolled')).toBe('true');
  });

  it('disconnects on unmount', () => {
    const { unmount } = mount();
    expect(instances[0].disconnected).toBe(false);
    unmount();
    expect(instances[0].disconnected).toBe(true);
  });

  it('does nothing without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { getByTestId } = mount();
    expect(getByTestId('header').hasAttribute('data-scrolled')).toBe(false);
  });
});
