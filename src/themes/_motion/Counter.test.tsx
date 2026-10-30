import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Counter, cubicBezier } from './Counter';

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let ioCallback: IOCallback | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Counter', () => {
  it('server-renders the authored value', () => {
    expect(renderToString(<Counter value="2,8k" prefix="~" />)).toContain('~<!-- -->2,8k');
  });

  it('counts up from 0 when in view and ends on the exact authored value', () => {
    const { container } = render(<Counter value="10,000" />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.textContent).toBe('10,000');
    act(() => ioCallback?.([{ isIntersecting: true, target: span }]));
    expect(span.textContent).toBe('0');
    act(() => vi.advanceTimersByTime(700));
    const mid = Number(span.textContent?.replace(/,/g, ''));
    expect(mid).toBeGreaterThan(5000);
    expect(mid).toBeLessThan(10000);
    act(() => vi.advanceTimersByTime(800));
    expect(span.textContent).toBe('10,000');
  });

  it('eases like cubic-bezier(0.16,1,0.3,1)', () => {
    const e = cubicBezier(0.16, 1, 0.3, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    expect(e(0.5)).toBeGreaterThan(0.85);
  });
});
