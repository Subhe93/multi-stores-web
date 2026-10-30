import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StaggerGroup, StaggerItem } from './Stagger';

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let ioCallback: IOCallback | null = null;
const observed = new Set<Element>();

beforeEach(() => {
  observed.clear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe(el: Element) {
        observed.add(el);
      }
      unobserve(el: Element) {
        observed.delete(el);
      }
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const tree = (props: { immediate?: boolean; step?: number } = {}) => (
  <StaggerGroup className="grid" {...props}>
    <StaggerItem>a</StaggerItem>
    {null}
    <StaggerItem className="b">b</StaggerItem>
    <StaggerItem>c</StaggerItem>
  </StaggerGroup>
);

describe('StaggerGroup SSR', () => {
  it('renders every item visible (no opacity / hidden state)', () => {
    for (const html of [renderToString(tree()), renderToString(tree({ immediate: true, step: 0.1 }))]) {
      expect(html).not.toContain('opacity');
      expect(html).not.toContain('transform');
      expect(html).not.toContain('data-stagger-state');
      expect(html.match(/data-stagger-item/g)).toHaveLength(3);
    }
    expect(renderToString(tree({ step: 0.1 }))).toContain('--stagger-step:0.1s');
  });
});

describe('StaggerGroup', () => {
  it('arms off-screen items with their index and shows them on intersection', () => {
    const { container } = render(tree());
    const group = container.firstElementChild as HTMLElement;
    const items = Array.from(group.children) as HTMLElement[];
    // jsdom rect is all zeros (bottom 0) => treated as off-screen.
    expect(items.map((el) => el.dataset.staggerState)).toEqual(['pending', 'pending', 'pending']);
    expect(items.map((el) => el.style.getPropertyValue('--stagger-i'))).toEqual(['0', '1', '2']);
    expect(observed.has(group)).toBe(true);
    act(() => ioCallback?.([{ isIntersecting: true, target: group }]));
    expect(items.every((el) => el.dataset.staggerState === 'shown')).toBe(true);
    expect(observed.has(group)).toBe(false);
  });

  it('never hides an immediate group', () => {
    const { container } = render(tree({ immediate: true }));
    const group = container.firstElementChild as HTMLElement;
    expect(group.querySelector('[data-stagger-state]')).toBeNull();
    expect(observed.size).toBe(0);
  });

  it('leaves a group already in the viewport visible', () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 10, bottom: 300 } as DOMRect);
    const { container } = render(tree());
    expect(container.querySelector('[data-stagger-state]')).toBeNull();
    spy.mockRestore();
  });
});
